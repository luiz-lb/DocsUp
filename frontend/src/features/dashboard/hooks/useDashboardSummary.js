import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { ACCESS, canAccess } from '../../../constants/access.js';
import { listLaborRequests } from '../../labor-requests/api/laborRequestsApi.js';
import { listDeliveredDocuments } from '../../documents/api/documentsRealApi.js';
import { listSuppliers } from '../../suppliers/api/suppliersApi.js';

// Status de labor_request (LABOR_REQUEST_STATUS)
const CLOSED_STATUSES = new Set([6, 7]);       // 6=Concluido, 7=Cancelado
const PENDING_APPROVAL_STATUS = 0;             // Pendente de Aprovação
const EM_COTACAO_STATUS = 3;                   // Em Cotação
const EM_CONTRATACAO_STATUS = 5;               // Em Contratação

// Status de documento que exigem atenção do RH/Segurança
const DOC_NEEDS_ATTENTION = new Set([0, 1, 4]); // Pendente, Validando, Reenvio Necessário

// Fornecedor ativo (SUPPLIER_STATUS = 1)
const SUPPLIER_ACTIVE = 1;

/**
 * Agrega indicadores reais para o painel inicial a partir de três fontes:
 * solicitações, documentos entregues e fornecedores. Tudo resiliente — se uma
 * fonte falhar, os demais indicadores continuam preenchidos.
 *
 * Documentos e fornecedores só são buscados por quem tem acesso a essas áreas
 * (o backend recusa os demais); `canSeeDocuments` / `canSeeSuppliers` dizem à tela o que mostrar.
 */
export function useDashboardSummary(department) {
  return useAsyncData(async () => {
    const canSeeDocuments = canAccess(department, ACCESS.supplierDocuments);
    const canSeeSuppliers = canAccess(department, ACCESS.suppliers);

    const [requestsResult, documents, suppliers] = await Promise.all([
      listLaborRequests({ limit: 200 }).catch(() => ({ body: [] })),
      canSeeDocuments ? listDeliveredDocuments({}).catch(() => []) : [],
      canSeeSuppliers ? listSuppliers().catch(() => []) : [],
    ]);

    const laborRequests = Array.isArray(requestsResult?.body) ? requestsResult.body : [];
    const docs = Array.isArray(documents) ? documents : [];
    const supplierList = Array.isArray(suppliers) ? suppliers : [];

    // ── Solicitações ──────────────────────────────────────────────────────
    const openLaborRequests = laborRequests.filter((r) => !CLOSED_STATUSES.has(r.status));
    const pendingApprovals = laborRequests.filter((r) => r.status === PENDING_APPROVAL_STATUS);
    const emCotacao = laborRequests.filter((r) => r.status === EM_COTACAO_STATUS);
    const emContratacao = laborRequests.filter((r) => r.status === EM_CONTRATACAO_STATUS);

    // Distribuição por status e urgência (para gráficos)
    const statusDistribution = countBy(laborRequests, (r) => r.status);
    const urgencyDistribution = countBy(laborRequests, (r) => r.urgency);

    // 5 solicitações mais recentes
    const recentRequests = [...laborRequests]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

    // ── Documentos ────────────────────────────────────────────────────────
    const docStatusDistribution = countBy(docs, (d) => d.status);
    const docsNeedingAttention = docs.filter((d) => DOC_NEEDS_ATTENTION.has(d.status)).length;
    const docsRejected = docs.filter((d) => d.status === 3).length;

    // ── Fornecedores ──────────────────────────────────────────────────────
    const activeSuppliers = supplierList.filter((s) => s.status === SUPPLIER_ACTIVE).length;
    const totalSuppliers = supplierList.length;

    return {
      canSeeDocuments,
      canSeeSuppliers,
      openLaborRequests,
      pendingApprovals,
      emCotacao,
      emContratacao,
      statusDistribution,
      urgencyDistribution,
      recentRequests,
      docStatusDistribution,
      docsNeedingAttention,
      docsRejected,
      totalDocuments: docs.length,
      activeSuppliers,
      totalSuppliers,
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
