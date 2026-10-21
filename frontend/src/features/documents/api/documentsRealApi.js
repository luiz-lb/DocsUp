import { api } from '../../../utils/api.js';
import { getApiErrorMessage, toErrorResult } from '../../../utils/apiError.js';
import { blobErrorMessage, fileNameFromDisposition, saveBlob } from '../../../utils/download.js';

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
 * Baixa os arquivos de documentos e salva no computador.
 * Um documento: GET /documents/:id/download (arquivo original).
 * Vários: POST /documents/download → um ZIP organizado por fornecedor, solicitação e colaborador.
 *
 * @param {number[]} documentIds
 * @returns {Promise<{ success: true, fileName } | { success: false, body: { message } }>}
 */
export async function downloadDocumentFiles(documentIds) {
  try {
    const isSingle = documentIds.length === 1;
    const result = isSingle
      ? await api.get(`/documents/${documentIds[0]}/download`, { responseType: 'blob' })
      : await api.post('/documents/download', { documentIds }, { responseType: 'blob' });

    const fileName = fileNameFromDisposition(
      result.headers['content-disposition'],
      isSingle ? 'documento' : 'documentos.zip',
    );
    saveBlob(result.data, fileName);
    return { success: true, fileName };
  } catch (error) {
    console.error('downloadDocumentFiles error:', error);
    return { success: false, body: { message: await blobErrorMessage(error, 'Erro ao baixar os documentos.') } };
  }
}

/**
 * Colaboradores com a situação e o resumo dos documentos (aba Colaboradores).
 * GET /documents/employees?search=&status=
 */
export async function listEmployeeSituations(params = {}) {
  try {
    const result = await api.get('/documents/employees', { params });
    return { success: true, body: result.data.body?.result ?? [] };
  } catch (error) {
    console.error('listEmployeeSituations error:', error);
    return { success: false, body: [], message: getApiErrorMessage(error, 'Erro ao buscar os colaboradores.') };
  }
}

/**
 * Muda a situação do colaborador.
 * PUT /documents/employees/:id/status  { status, integrationAt? ('AAAA-MM-DDTHH:mm') }
 */
export async function setEmployeeSituation(employeeId, status, integrationAt) {
  try {
    const result = await api.put(`/documents/employees/${employeeId}/status`, { status, integrationAt });
    return result.data;
  } catch (error) {
    console.error('setEmployeeSituation error:', error);
    return toErrorResult(error, 'Erro ao atualizar a situação do colaborador.');
  }
}

/**
 * Histórico de entregas do documento (mais nova primeiro).
 * GET /documents/:id/history → { deliveries: [...] }
 */
export async function getDocumentHistory(documentId) {
  try {
    const result = await api.get(`/documents/${documentId}/history`);
    return { success: true, body: result.data.body?.deliveries ?? [] };
  } catch (error) {
    console.error('getDocumentHistory error:', error);
    return toErrorResult(error, 'Erro ao buscar o histórico do documento.');
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
