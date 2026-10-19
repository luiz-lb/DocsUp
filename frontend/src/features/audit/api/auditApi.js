import { api } from '../../../utils/api.js';
import { getApiErrorMessage } from '../../../utils/apiError.js';

// ---------------------------------------------------------------------------
// Auditoria (só Admin): /audit-logs
// ---------------------------------------------------------------------------

/**
 * Lista a auditoria, mais recente primeiro.
 * @param {{page?: number, limit?: number, search?: string, action?: string, from?: string, to?: string}} params
 *   from / to: datas 'AAAA-MM-DD' (inclusivas).
 */
export async function listAuditLogs(params = {}) {
  try {
    const result = await api.get('/audit-logs', { params });
    return { success: true, body: result.data.body.result, pagination: result.data.body.pagination };
  } catch (error) {
    console.error('Erro ao buscar auditoria:', error);
    return {
      success: false,
      body: [],
      pagination: null,
      message: getApiErrorMessage(error, 'Erro ao buscar a auditoria.'),
    };
  }
}
