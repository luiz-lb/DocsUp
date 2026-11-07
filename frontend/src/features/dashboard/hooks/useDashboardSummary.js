import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { ACCESS, canAccess } from '../../../constants/access.js';
import { LABOR_REQUEST_STATUS_ID } from '../../../constants/enums.js';
import { getLaborRequestSummary, listLaborRequests } from '../../labor-requests/api/laborRequestsApi.js';
import { listDeliveredDocuments } from '../../documents/api/documentsRealApi.js';
import { listSuppliers } from '../../suppliers/api/suppliersApi.js';

// Status de documento que exigem atenção do RH/Segurança
const DOC_NEEDS_ATTENTION = new Set([0, 1, 4]); // Pendente, Validando, Reenvio Necessário

// Fornecedor ativo (SUPPLIER_STATUS = 1)
const SUPPLIER_ACTIVE = 1;

/**
 * Indicadores do painel inicial, de três fontes: o resumo das solicitações (contagem por
 * status e urgência, calculada no banco), os documentos entregues e os fornecedores. Tudo
 * resiliente — se uma fonte falhar, os demais indicadores continuam preenchidos.
 *
 * Documentos e fornecedores só são buscados por quem tem acesso a essas áreas
 * (o backend recusa os demais); `canSeeDocuments` / `canSeeSuppliers` dizem à tela o que mostrar.
 */
export function useDashboardSummary(department) {
  return useAsyncData(async () => {
    const canSeeDocuments = canAccess(department, ACCESS.supplierDocuments);
    const canSeeSuppliers = canAccess(department, ACCESS.suppliers);

    const [summaryResult, recentResult, documents, suppliers] = await Promise.all([
      getLaborRequestSummary().catch(() => ({ success: false })),
      listLaborRequests({ page: 1, limit: 10 }).catch(() => ({ body: [] })),
      canSeeDocuments ? listDeliveredDocuments({}).catch(() => []) : [],
      canSeeSuppliers ? listSuppliers().catch(() => []) : [],
    ]);

    const byStatus = summaryResult?.success ? summaryResult.body.byStatus ?? {} : {};
    const byUrgency = summaryResult?.success ? summaryResult.body.byUrgency ?? {} : {};
    const countOf = (status) => Number(byStatus[status] ?? 0);

    const recentList = Array.isArray(recentResult?.body) ? recentResult.body : [];
    const docs = Array.isArray(documents) ? documents : [];
    const supplierList = Array.isArray(suppliers) ? suppliers : [];

    return {
      canSeeDocuments,
      canSeeSuppliers,
      // ── Solicitações ──
      pendingApprovals: countOf(LABOR_REQUEST_STATUS_ID.PENDENTE),
      awaitingSupplier: countOf(LABOR_REQUEST_STATUS_ID.AGUARDANDO_FORNECEDOR),
      blocked: countOf(LABOR_REQUEST_STATUS_ID.BLOQUEADA),
      inContracting: countOf(LABOR_REQUEST_STATUS_ID.EM_CONTRATACAO),
      statusDistribution: byStatus,
      urgencyDistribution: byUrgency,
      // 5 solicitações mais recentes (a lista já vem da mais nova para a mais antiga)
      recentRequests: recentList.slice(0, 5),
      // ── Documentos ──
      docStatusDistribution: countBy(docs, (d) => d.status),
      docsNeedingAttention: docs.filter((d) => DOC_NEEDS_ATTENTION.has(d.status)).length,
      totalDocuments: docs.length,
      // ── Fornecedores ──
      activeSuppliers: supplierList.filter((s) => s.status === SUPPLIER_ACTIVE).length,
      totalSuppliers: supplierList.length,
    };
  }, [department]);
}

/** Conta ocorrências por chave; retorna { [key]: count }. */
function countBy(items, keyFn) {
  const acc = {};
  for (const item of items) {
    const key = keyFn(item);
    if (key === undefined || key === null) continue;
    acc[key] = (acc[key] ?? 0) + 1;
  }
  return acc;
}
