import { api } from '../../../utils/api.js';

// ─────────────────────────────────────────────
// Painel interno (colaboradores)
// ─────────────────────────────────────────────

/**
 * Cria uma rodada de cotação com convites.
 * POST /quotations/rounds/create
 */
export async function createRound(payload) {
  try {
    const result = await api.post('/quotations/rounds/create', payload);
    return result.data;
  } catch (error) {
    console.error('createRound error:', error);
    return { success: false, body: { message: 'Erro ao criar rodada.' } };
  }
}

/**
 * Busca dados de uma rodada com cotações ranqueadas.
 * GET /quotations/rounds/:roundId
 */
export async function getQuotationRound(roundId) {
  try {
    const result = await api.get(`/quotations/rounds/${roundId}`);
    if (!result.data.success) {
      return null;
    }
    return result.data.body.round;
  } catch (error) {
    console.error('getQuotationRound error:', error);
    return null;
  }
}

/**
 * Lista rounds de uma solicitação.
 * GET /quotations/rounds/byRequest/:laborRequestId
 */
export async function listRoundsByLaborRequest(laborRequestId) {
  try {
    const result = await api.get(`/quotations/rounds/byRequest/${laborRequestId}`);
    if (!result.data.success) return { success: false, body: { rounds: [] } };
    return { success: true, body: result.data.body };
  } catch (error) {
    console.error('listRoundsByLaborRequest error:', error);
    return { success: false, body: { rounds: [] } };
  }
}

/**
 * Retorna o round mais recente de uma solicitação (round_number DESC).
 * Retorna null se ainda não houver nenhum round.
 */
export async function getLatestRoundByLaborRequest(laborRequestId) {
  try {
    const result = await api.get(`/quotations/rounds/byRequest/${laborRequestId}`);
    if (!result.data.success) return null;
    const rounds = result.data.body?.rounds ?? [];
    // rounds já vem ordenado por round_number DESC
    return rounds[0] ?? null;
  } catch (error) {
    console.error('getLatestRoundByLaborRequest error:', error);
    return null;
  }
}

/**
 * Declara o vencedor da rodada.
 * POST /quotations/rounds/declareWinner
 */
export async function declareWinner(roundId, winnerQuotationId, deadlineHours) {
  try {
    const result = await api.post('/quotations/rounds/declareWinner', {
      roundId,
      winnerQuotationId,
      deadlineHours,
    });
    return result.data;
  } catch (error) {
    console.error('declareWinner error:', error);
    return { success: false, body: { message: 'Erro ao declarar vencedor.' } };
  }
}

/**
 * Compara múltiplas cotações de uma rodada (retorna dados p/ gráficos).
 * POST /quotations/rounds/:roundId/compare
 * @param {number}   roundId
 * @param {number[]} quotationIds
 */
export async function compareQuotations(roundId, quotationIds) {
  try {
    const result = await api.post(`/quotations/rounds/${roundId}/compare`, { quotationIds });
    if (!result.data.success) return null;
    return result.data.body;
  } catch (error) {
    console.error('compareQuotations error:', error);
    return null;
  }
}

/**
 * Adiciona um novo convite a uma rodada existente (mesmo prazo do round).
 * POST /quotations/rounds/addInvite
 */
export async function addInviteToRound(roundId, inviteeEmail) {
  try {
    const result = await api.post('/quotations/rounds/addInvite', { roundId, inviteeEmail });
    return result.data;
  } catch (error) {
    console.error('addInviteToRound error:', error);
    return { success: false, body: { message: 'Erro ao adicionar convite.' } };
  }
}

// ─────────────────────────────────────────────
// Portal do Fornecedor
// ─────────────────────────────────────────────

/**
 * Busca dados do convite para o fornecedor preencher a cotação.
 * GET /quotations/invite/:token  (público)
 */
export async function getInviteByToken(token) {
  try {
    const result = await api.get(`/quotations/invite/${token}`);
    if (!result.data.success) {
      return null;
    }
    return result.data.body;
  } catch (error) {
    console.error('getInviteByToken error:', error);
    return null;
  }
}

/**
 * Submete a cotação do fornecedor.
 * POST /quotations/submit/:token  (exige cookie supplier_token)
 */
export async function submitQuotation(token, payload) {
  try {
    const result = await api.post(`/quotations/submit/${token}`, payload);
    return result.data;
  } catch (error) {
    console.error('submitQuotation error:', error);
    return { success: false, body: { message: 'Erro ao enviar cotação.' } };
  }
}
