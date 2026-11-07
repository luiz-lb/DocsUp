import { api } from '../../../utils/api.js';
import { toErrorResult } from '../../../utils/apiError.js';

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
    return toErrorResult(error, 'Erro ao buscar solicitação.');
  }
}

export async function createLaborRequest(payload) {
  try {
    const result = await api.post('/laborRequest/create', payload);
    // Propaga a mensagem específica do backend quando success=false
    if (!result.data.success) {
      return result.data;
    }
    return result.data;
  } catch (error) {
    console.error('Erro ao criar solicitação:', error);
    return toErrorResult(error, 'Erro ao criar solicitação.');
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
 * @param {string}   contractNumber  - número do contrato, obrigatório ao aprovar (decision=2)
 */
export async function submitApproval(laborRequestId, decision, comments, documentTypeIds, nrTypeIds, contractNumber) {
  try {
    const result = await api.post('/laborRequest/approveRequest', {
      laborRequestId,
      decision,
      comments,
      documentTypeIds,
      nrTypeIds,
      contractNumber,
    });
    return result.data;
  } catch (error) {
    console.error('Erro ao registrar aprovação:', error);
    return toErrorResult(error, 'Erro ao registrar aprovação.');
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

/** Básicos (categoria 1) e outros (categoria 3) do colaborador, ativos. */
export async function getEmployeeDocumentTypes() {
  try {
    const result = await api.get('/docRequired/employee_document_types');
    return { success: true, body: result.data.body.result };
  } catch (error) {
    console.error('Erro ao buscar tipos de documento do colaborador:', error);
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

// ---------------------------------------------------------------------------
// Resumo (painel inicial)
// ---------------------------------------------------------------------------

/**
 * Quantidade de solicitações por status e por urgência.
 * GET /laborRequest/summary → { byStatus: { [status]: n }, byUrgency: { [urgency]: n }, total }
 */
export async function getLaborRequestSummary() {
  try {
    const result = await api.get('/laborRequest/summary');
    return { success: true, body: result.data.body };
  } catch (error) {
    console.error('Erro ao buscar o resumo das solicitações:', error);
    return toErrorResult(error, 'Erro ao buscar o resumo das solicitações.');
  }
}

// ---------------------------------------------------------------------------
// Fornecedor da solicitação (Compras indica pelo e-mail)
// ---------------------------------------------------------------------------

/**
 * Fornecedor da solicitação: vínculo atual, declaração, o que era para declarar e histórico.
 * GET /laborRequest/:id/supplier
 * → { current, declaration, declarationItems, history, canManage, mailEnabled }
 */
export async function getRequestSupplier(laborRequestId) {
  try {
    const result = await api.get(`/laborRequest/${laborRequestId}/supplier`);
    return { success: true, body: result.data.body };
  } catch (error) {
    console.error('Erro ao buscar o fornecedor da solicitação:', error);
    return toErrorResult(error, 'Erro ao buscar o fornecedor da solicitação.');
  }
}

/**
 * O e-mail já tem cadastro no portal? (Compras)
 * GET /laborRequest/supplier-lookup?email= → { email, registered, supplier?, user? }
 */
export async function lookupSupplierEmail(email) {
  try {
    const result = await api.get('/laborRequest/supplier-lookup', { params: { email } });
    return { success: true, body: result.data.body };
  } catch (error) {
    return toErrorResult(error, 'Erro ao buscar o e-mail.');
  }
}

/**
 * Indica o fornecedor. POST /laborRequest/:id/supplier
 * @param {{ email, deadlineHours? , deadlineAt? }} payload
 */
export async function assignSupplier(laborRequestId, payload) {
  try {
    const result = await api.post(`/laborRequest/${laborRequestId}/supplier`, payload);
    return result.data;
  } catch (error) {
    return toErrorResult(error, 'Erro ao indicar o fornecedor.');
  }
}

/** Reenvia o convite para o mesmo e-mail (recomeça do zero). POST /laborRequest/:id/supplier/resend */
export async function resendSupplierInvite(laborRequestId, payload) {
  try {
    const result = await api.post(`/laborRequest/${laborRequestId}/supplier/resend`, payload);
    return result.data;
  } catch (error) {
    return toErrorResult(error, 'Erro ao reenviar o convite.');
  }
}

/** Novo prazo dos documentos. PUT /laborRequest/:id/supplier/deadline */
export async function changeSupplierDeadline(laborRequestId, payload) {
  try {
    const result = await api.put(`/laborRequest/${laborRequestId}/supplier/deadline`, payload);
    return result.data;
  } catch (error) {
    return toErrorResult(error, 'Erro ao mudar o prazo.');
  }
}

/**
 * Troca o fornecedor (o atual perde o acesso; os documentos dele ficam guardados).
 * POST /laborRequest/:id/supplier/replace  Body: { email, reason, deadlineHours? | deadlineAt? }
 */
export async function replaceSupplier(laborRequestId, payload) {
  try {
    const result = await api.post(`/laborRequest/${laborRequestId}/supplier/replace`, payload);
    return result.data;
  } catch (error) {
    return toErrorResult(error, 'Erro ao trocar o fornecedor.');
  }
}

/** Conclui o contrato (RH ou Compras). POST /laborRequest/:id/conclude */
export async function concludeLaborRequest(laborRequestId) {
  try {
    const result = await api.post(`/laborRequest/${laborRequestId}/conclude`);
    return result.data;
  } catch (error) {
    return toErrorResult(error, 'Erro ao concluir o contrato.');
  }
}
