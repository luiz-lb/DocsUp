import { api } from '../../../utils/api.js';
import { getApiErrorMessage, toErrorResult } from '../../../utils/apiError.js';

// ---------------------------------------------------------------------------
// Parâmetros (só Admin): catálogo de tipos de documento e atividades
// ---------------------------------------------------------------------------

/**
 * Lista os tipos de documento (sem paginação).
 * @param {{category?: number, status?: '1'|'0', search?: string}} params
 *   category: 0 empresa, 1 básico, 2 NR, 3 outros (sem valor = todas).
 *   status: '1' = ativos, '0' = inativos, sem valor = todos.
 */
export async function listDocumentTypes(params = {}) {
  try {
    const result = await api.get('/parameters/document-types', { params });
    return { success: true, body: result.data.body.result };
  } catch (error) {
    console.error('Erro ao buscar tipos de documento:', error);
    return { success: false, body: [], message: getApiErrorMessage(error, 'Erro ao buscar os tipos de documento.') };
  }
}

/** POST /parameters/document-types — { name, description, category, hasExpiration, validityDays, code? } */
export async function createDocumentType(payload) {
  try {
    const result = await api.post('/parameters/document-types', payload);
    return result.data;
  } catch (error) {
    console.error('Erro ao criar tipo de documento:', error);
    return toErrorResult(error, 'Erro ao criar o tipo de documento.');
  }
}

/** PUT /parameters/document-types/:id — { name, description, hasExpiration, validityDays, category?, code? } */
export async function updateDocumentType(id, payload) {
  try {
    const result = await api.put(`/parameters/document-types/${id}`, payload);
    return result.data;
  } catch (error) {
    console.error('Erro ao atualizar tipo de documento:', error);
    return toErrorResult(error, 'Erro ao atualizar o tipo de documento.');
  }
}

/** PUT /parameters/document-types/:id/status — ativa (true) ou inativa (false) */
export async function setDocumentTypeStatus(id, isActive) {
  try {
    const result = await api.put(`/parameters/document-types/${id}/status`, { isActive });
    return result.data;
  } catch (error) {
    console.error('Erro ao alterar status do tipo de documento:', error);
    return toErrorResult(error, 'Erro ao alterar o status do tipo de documento.');
  }
}

/**
 * Lista as atividades (sem paginação), com os documentos sugeridos de cada uma.
 * @param {{status?: '1'|'0', search?: string}} params
 */
export async function listActivities(params = {}) {
  try {
    const result = await api.get('/parameters/activities', { params });
    return { success: true, body: result.data.body.result };
  } catch (error) {
    console.error('Erro ao buscar atividades:', error);
    return { success: false, body: [], message: getApiErrorMessage(error, 'Erro ao buscar as atividades.') };
  }
}

/** POST /parameters/activities — { name, description, riskLevel, documentTypeIds } */
export async function createActivity(payload) {
  try {
    const result = await api.post('/parameters/activities', payload);
    return result.data;
  } catch (error) {
    console.error('Erro ao criar atividade:', error);
    return toErrorResult(error, 'Erro ao criar a atividade.');
  }
}

/** PUT /parameters/activities/:id — { name, description, riskLevel, documentTypeIds } */
export async function updateActivity(id, payload) {
  try {
    const result = await api.put(`/parameters/activities/${id}`, payload);
    return result.data;
  } catch (error) {
    console.error('Erro ao atualizar atividade:', error);
    return toErrorResult(error, 'Erro ao atualizar a atividade.');
  }
}

/** PUT /parameters/activities/:id/status — ativa (true) ou inativa (false) */
export async function setActivityStatus(id, isActive) {
  try {
    const result = await api.put(`/parameters/activities/${id}/status`, { isActive });
    return result.data;
  } catch (error) {
    console.error('Erro ao alterar status da atividade:', error);
    return toErrorResult(error, 'Erro ao alterar o status da atividade.');
  }
}
