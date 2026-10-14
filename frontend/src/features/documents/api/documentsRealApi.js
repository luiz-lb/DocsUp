import { api } from '../../../utils/api.js';
import { toErrorResult } from '../../../utils/apiError.js';

// ─────────────────────────────────────────────
// Central de documentos (dados reais do backend)
// ─────────────────────────────────────────────

/**
 * Lista documentos entregues pelos fornecedores, com validação mais recente.
 * GET /documents  (filtros opcionais: supplierId, laborRequestId, status)
 */
export async function listDeliveredDocuments(filters = {}) {
  try {
    const params = new URLSearchParams();
    if (filters.supplierId) params.append('supplierId', filters.supplierId);
    if (filters.laborRequestId) params.append('laborRequestId', filters.laborRequestId);
    if (filters.status !== undefined && filters.status !== '') params.append('status', filters.status);

    const result = await api.get(`/documents?${params.toString()}`);
    if (!result.data.success) return [];
    return result.data.body?.documents ?? [];
  } catch (error) {
    console.error('listDeliveredDocuments error:', error);
    return [];
  }
}

/**
 * Atualiza o status de um documento (0..5).
 * POST /documents/set-status
 * @param {number} documentId
 * @param {number} status  — 0=Pendente,1=Validando,2=Aprovado,3=Reprovado,4=Reenvio,5=Expirado
 * @param {string} [comments]
 */
export async function setDocumentStatus(documentId, status, comments) {
  try {
    const result = await api.post('/documents/set-status', { documentId, status, comments });
    return result.data;
  } catch (error) {
    console.error('setDocumentStatus error:', error);
    return toErrorResult(error, 'Erro ao atualizar status.');
  }
}
