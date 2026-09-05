import * as quotationService from '../services/quotationService.js';

// ─────────────────────────────────────────────
// Painel interno (colaboradores autenticados)
// ─────────────────────────────────────────────

/**
 * Cria uma rodada de cotação e envia convites.
 * POST /quotations/rounds/create
 * Body: { laborRequestId, deadline, invitees: [{ supplierId?, email }], deadlineHoursPhase2? }
 */
export async function createRound(req, res) {
    try {
        const { laborRequestId, deadline, invitees, deadlineHoursPhase2 } = req.body;
        const createdBy = req.usuario.id;

        if (!laborRequestId || !deadline || !invitees?.length) {
            return res.status(400).json({
                success: false,
                body: { message: 'laborRequestId, deadline e ao menos um invitee são obrigatórios.' },
            });
        }

        const result = await quotationService.createRound({
            laborRequestId: Number(laborRequestId),
            deadline,
            createdBy,
            invitees,
            deadlineHoursPhase2,
        });

        if (!result.success) {
            return res.status(400).json({ success: false, body: { message: result.message } });
        }

        return res.status(201).json({ success: true, body: result });
    } catch (error) {
        console.error('createRound controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/**
 * Busca dados de uma rodada com cotações.
 * GET /quotations/rounds/:roundId
 */
export async function getRound(req, res) {
    try {
        const roundId = Number(req.params.roundId);
        if (!Number.isInteger(roundId) || roundId <= 0) {
            return res.status(400).json({ success: false, body: { message: 'roundId inválido.' } });
        }

        const result = await quotationService.getRound(roundId);
        if (!result.success) {
            return res.status(404).json({ success: false, body: { message: result.message } });
        }

        return res.status(200).json({ success: true, body: result.body });
    } catch (error) {
        console.error('getRound controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/**
 * Lista os rounds de uma solicitação.
 * GET /quotations/rounds/byRequest/:laborRequestId
 */
export async function listRoundsByLaborRequest(req, res) {
    try {
        const laborRequestId = Number(req.params.laborRequestId);
        if (!Number.isInteger(laborRequestId) || laborRequestId <= 0) {
            return res.status(400).json({ success: false, body: { message: 'laborRequestId inválido.' } });
        }

        const result = await quotationService.listRoundsByLaborRequest(laborRequestId);
        if (!result.success) {
            return res.status(500).json({ success: false, body: { message: result.message } });
        }

        return res.status(200).json({ success: true, body: result.body });
    } catch (error) {
        console.error('listRoundsByLaborRequest controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/**
 * Declara o vencedor da rodada.
 * POST /quotations/rounds/declareWinner
 * Body: { roundId, winnerQuotationId, deadlineHours? }
 */
export async function declareWinner(req, res) {
    try {
        const { roundId, winnerQuotationId, deadlineHours } = req.body;
        const userId = req.usuario.id;

        if (!roundId || !winnerQuotationId) {
            return res.status(400).json({
                success: false,
                body: { message: 'roundId e winnerQuotationId são obrigatórios.' },
            });
        }

        const result = await quotationService.declareWinner({
            roundId: Number(roundId),
            winnerQuotationId: Number(winnerQuotationId),
            deadlineHours: deadlineHours ? Number(deadlineHours) : 72,
            userId,
        });

        if (!result.success) {
            return res.status(400).json({ success: false, body: { message: result.message } });
        }

        return res.status(200).json({ success: true, body: result.body });
    } catch (error) {
        console.error('declareWinner controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/**
 * Adiciona um novo convite a uma rodada existente.
 * POST /quotations/rounds/addInvite
 * Body: { roundId, inviteeEmail }
 */
export async function addInviteToRound(req, res) {
    try {
        const { roundId, inviteeEmail } = req.body;
        const createdBy = req.usuario.id;

        if (!roundId || !inviteeEmail) {
            return res.status(400).json({
                success: false,
                body: { message: 'roundId e inviteeEmail são obrigatórios.' },
            });
        }

        const result = await quotationService.addInviteToRound({
            roundId: Number(roundId),
            inviteeEmail,
            createdBy,
        });

        if (!result.success) {
            return res.status(400).json({ success: false, body: { message: result.message } });
        }

        return res.status(201).json({ success: true, body: { inviteId: result.inviteId } });
    } catch (error) {
        console.error('addInviteToRound controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/**
 * Retorna os dados do convite para o fornecedor preencher a cotação.
 * GET /quotations/invite/:token  (público)
 */
export async function getInviteByToken(req, res) {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).json({ success: false, body: { message: 'Token é obrigatório.' } });
        }

        const result = await quotationService.getInviteByToken(token);
        if (!result.success) {
            return res.status(404).json({ success: false, body: { message: result.message } });
        }

        return res.status(200).json({ success: true, body: result.body });
    } catch (error) {
        console.error('getInviteByToken controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/**
 * Lista as cotações do fornecedor autenticado.
 * GET /quotations/supplier/my-quotations  (requer JWT de fornecedor)
 */
export async function getMyQuotations(req, res) {
    try {
        const supplierId = req.fornecedor?.supplierId;
        if (!supplierId) {
            return res.status(401).json({ success: false, body: { message: 'Fornecedor não identificado.' } });
        }

        const result = await quotationService.getQuotationsBySupplier(supplierId);
        if (!result.success) {
            return res.status(500).json({ success: false, body: { message: result.message } });
        }

        return res.status(200).json({ success: true, body: result.body });
    } catch (error) {
        console.error('getMyQuotations controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/**
 * Submete a cotação do fornecedor.
 * POST /quotations/submit/:token  (requer autenticação de fornecedor)
 */
export async function submitQuotation(req, res) {
    try {
        const { token } = req.params;
        const supplierId = req.fornecedor?.supplierId ?? null;

        // Captura IP real (suporte a proxies)
        const clientIp =
            req.headers['x-forwarded-for']?.split(',')[0]?.trim() ??
            req.socket?.remoteAddress ??
            null;
        const userAgent = req.headers['user-agent'] ?? null;

        const result = await quotationService.submitQuotation(
            token,
            req.body,
            supplierId,
            clientIp,
            userAgent,
        );

        if (!result.success) {
            return res.status(400).json({ success: false, body: { message: result.message } });
        }

        return res.status(201).json({ success: true, body: result.body });
    } catch (error) {
        console.error('submitQuotation controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}
