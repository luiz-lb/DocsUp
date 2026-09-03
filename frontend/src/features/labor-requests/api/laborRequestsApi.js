import { api } from '../../../utils/api.js';

// ---------------------------------------------------------------------------
// Labor Requests
// ---------------------------------------------------------------------------

/**
 * Lista solicitações com paginação, busca e filtros.
 * @param {{page?: number, limit?: number, search?: string, status?: number, urgency?: number}} params
 */
export async function listLaborRequests(params = {}) {
  try {
    const result = await api.get('/laborRequest/list', { params });
    return { success: true, body: result.data.body.result, pagination: result.data.body.pagination };
  } catch (error) {
    console.error('Erro ao buscar solicitações:', error);
    return { success: false, body: [], pagination: null };
  }
}

export async function getLaborRequestById(id) {
  try {
    const result = await api.get(`/laborRequest/listById/${id}`);
    if (!result.data.success) {
      return { success: false, body: { message: result.data.body.message } };
    }
    return result.data;
  } catch (error) {
    console.error('Erro ao buscar solicitação:', error);
    return { success: false, body: { message: 'Erro ao buscar solicitação.' } };
  }
}

export async function createLaborRequest(payload) {
  try {
    const result = await api.post('/laborRequest/create', payload);
    if (!result.data.success) {
      return { success: false, body: { message: 'Erro ao criar solicitação.' } };
    }
    return result.data;
  } catch (error) {
    console.error('Erro ao criar solicitação:', error);
    return { success: false, body: { message: 'Erro ao criar solicitação.' } };
  }
}

// ---------------------------------------------------------------------------
// Aprovações
// ---------------------------------------------------------------------------

/**
 * Busca aprovações de uma solicitação.
 * GET /laborRequest/listApprovals/:id
 */
export async function getApprovals(laborRequestId) {
  try {
    const result = await api.get(`/laborRequest/listApprovals/${laborRequestId}`);
    if (!result.data.success) {
      return { success: false, body: { approvals: [] } };
    }
    return { success: true, body: result.data.body };
  } catch (error) {
    console.error('Erro ao buscar aprovações:', error);
    return { success: false, body: { approvals: [] } };
  }
}

/**
 * Registra decisão de aprovação (Segurança do Trabalho).
 * POST /laborRequest/approveRequest
 *
 * @param {number}   laborRequestId
 * @param {number}   decision        - 1=Reprovado, 2=Aprovado
 * @param {string}   comments
 * @param {number[]} documentTypeIds - obrigatório ao aprovar (decision=2)
 * @param {number[]} nrTypeIds       - NRs exigidas, obrigatório ao aprovar (decision=2)
 */
export async function submitApproval(laborRequestId, decision, comments, documentTypeIds, nrTypeIds) {
  try {
    const result = await api.post('/laborRequest/approveRequest', {
      laborRequestId,
      decision,
      comments,
      documentTypeIds,
      nrTypeIds,
    });
    return result.data;
  } catch (error) {
    console.error('Erro ao registrar aprovação:', error);
    return { success: false, body: { message: 'Erro ao registrar aprovação.' } };
  }
}

/**
 * Atualiza os documentos obrigatórios de uma solicitação aprovada.
 * POST /laborRequest/updateDocsRequired
 */
export async function updateDocsRequired(laborRequestId, documentTypeIds) {
  try {
    const result = await api.post('/laborRequest/updateDocsRequired', {
      laborRequestId,
      documentTypeIds,
    });
    return result.data;
  } catch (error) {
    console.error('Erro ao atualizar documentos obrigatórios:', error);
    return { success: false, body: { message: 'Erro ao atualizar documentos.' } };
  }
}

// ---------------------------------------------------------------------------
// Dados de referência
// ---------------------------------------------------------------------------

export async function getActivityTypes() {
  try {
    const result = await api.get('/docRequired/activity_types');
    return { success: true, body: result.data.body.result };
  } catch (error) {
    console.error('Erro ao buscar tipos de atividades:', error);
    return { success: false, body: [] };
  }
}

export async function getDocumentsTypes() {
  try {
    const result = await api.get('/docRequired/document_types');
    return { success: true, body: result.data.body.result };
  } catch (error) {
    console.error('Erro ao buscar tipos de documentos:', error);
    return { success: false, body: [] };
  }
}

export async function getNrTypes() {
  try {
    const result = await api.get('/docRequired/nr_types');
    return { success: true, body: result.data.body.result };
  } catch (error) {
    console.error('Erro ao buscar NRs:', error);
    return { success: false, body: [] };
  }
}
