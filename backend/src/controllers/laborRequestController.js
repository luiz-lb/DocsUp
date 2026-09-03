import * as laborRequestService from '../services/laborRequestService.js'

const ALLOWED_PAGE_SIZES = [10, 25, 50, 100];

export async function createLaborRequest(req, res) {
    try {
        const { activityTypeId, title, description, location, urgency, startDate } = req.body;

        const idUser = req.usuario.id;

        if (!idUser || !activityTypeId || !title || !location || !urgency || !startDate) {
            return res.status(400).json({ success: false, body: { message: "Falta de informações para criação de solicitação." } });
        }

        const result = await laborRequestService.createLaborRequest(idUser, activityTypeId, title, description, location, urgency, startDate);

        if (result.success) {
            return res.status(200).json({ success: true, body: { message: "Solicitação criada com sucesso.", solicitacaoId: result.body.solicitacaoId } });
        } else {
            return res.status(200).json({ success: false, body: { message: result.body.message } });
        }
    } catch (error) {
        console.error('Erro no createLaborRequest controller:', error);
        return res.status(500).json({ success: false, body: { message: "Erro interno do servidor." } });
    }
}

export async function listLaborRequest(req, res) {
    try {
        const { page: pageParam, limit: limitParam, search: searchParam, status: statusParam, urgency: urgencyParam } = req.query;

        const page = Math.max(Number.parseInt(pageParam, 10) || 1, 1);
        const parsedLimit = Number.parseInt(limitParam, 10);
        const limit = ALLOWED_PAGE_SIZES.includes(parsedLimit) ? parsedLimit : 10;
        const search = typeof searchParam === 'string' ? searchParam.trim().slice(0, 200) : '';

        const status = statusParam !== undefined && statusParam !== '' ? Number.parseInt(statusParam, 10) : undefined;
        const urgency = urgencyParam !== undefined && urgencyParam !== '' ? Number.parseInt(urgencyParam, 10) : undefined;

        if (status !== undefined && Number.isNaN(status)) {
            return res.status(400).json({ success: false, body: { message: "status deve ser um número válido." } });
        }
        if (urgency !== undefined && Number.isNaN(urgency)) {
            return res.status(400).json({ success: false, body: { message: "urgency deve ser um número válido." } });
        }

        const result = await laborRequestService.listLaborRequest({ page, limit, search, status, urgency });

        if (result.success) {
            return res.status(200).json({
                success: true,
                body: {
                    message: "Solicitações listadas.",
                    result: result.body.solicitacoes,
                    pagination: result.body.pagination,
                },
            });
        } else {
            return res.status(200).json({ success: false, body: { message: result.body.message } });
        }
    } catch (error) {
        console.error('Erro no listLaborRequest controller:', error);
        return res.status(500).json({ success: false, body: { message: "Erro interno do servidor." } });
    }
}

export async function listLaborRequestById(req, res) {
    try {
        const { id } = req.params;
        const idLaborRequest = Number(id);

        if (!Number.isInteger(idLaborRequest) || idLaborRequest <= 0) {
            return res.status(400).json({ success: false, body: { message: "O id da solicitação deve ser um número inteiro válido." } });
        }

        const result = await laborRequestService.listLaborRequestById(idLaborRequest);

        if (result.success) {
            return res.status(200).json({ success: true, body: { message: "Solicitação encontrada.", result: result.body.solicitacao } });
        } else {
            return res.status(404).json({ success: false, body: { message: result.body.message } });
        }
    } catch (error) {
        console.error('Erro no listLaborRequestById controller:', error);
        return res.status(500).json({ success: false, body: { message: "Erro interno do servidor." } });
    }
}

/**
 * Busca as aprovações de uma solicitação.
 * GET /laborRequest/listApprovals/:id
 */
export async function listApprovals(req, res) {
    try {
        const { id } = req.params;
        const laborRequestId = Number(id);

        if (!Number.isInteger(laborRequestId) || laborRequestId <= 0) {
            return res.status(400).json({ success: false, body: { message: "ID inválido." } });
        }

        const result = await laborRequestService.listApprovals(laborRequestId);

        if (result.success) {
            return res.status(200).json({ success: true, body: result.body });
        } else {
            return res.status(500).json({ success: false, body: { message: result.body.message } });
        }
    } catch (error) {
        console.error('Erro no listApprovals controller:', error);
        return res.status(500).json({ success: false, body: { message: "Erro interno do servidor." } });
    }
}

/**
 * Registra a decisão de aprovação (Segurança do Trabalho).
 * POST /laborRequest/approveRequest
 *
 * Body: { laborRequestId, decision, comments, documentTypeIds[], nrTypeIds[] }
 */
export async function approveRequest(req, res) {
    try {
        const { laborRequestId, decision, comments, documentTypeIds, nrTypeIds } = req.body;
        const approverId = req.usuario.id;
        const department = req.usuario.department;

        if (!laborRequestId || decision === undefined) {
            return res.status(400).json({ success: false, body: { message: "laborRequestId e decision são obrigatórios." } });
        }

        const decisionNum = Number(decision);
        if (![1, 2].includes(decisionNum)) {
            return res.status(400).json({ success: false, body: { message: "decision deve ser 1 (Reprovado) ou 2 (Aprovado)." } });
        }

        const result = await laborRequestService.approveRequest(
            Number(laborRequestId),
            approverId,
            department,
            decisionNum,
            comments,
            documentTypeIds,
            nrTypeIds
        );

        if (result.success) {
            return res.status(200).json({ success: true, body: result.body });
        } else {
            return res.status(400).json({ success: false, body: { message: result.body.message } });
        }
    } catch (error) {
        console.error('Erro no approveRequest controller:', error);
        return res.status(500).json({ success: false, body: { message: "Erro interno do servidor." } });
    }
}

/**
 * Segurança do Trabalho atualiza os documentos obrigatórios de uma solicitação aprovada.
 * POST /laborRequest/updateDocsRequired
 *
 * Body: { laborRequestId, documentTypeIds[] }
 */
export async function updateDocsRequired(req, res) {
    try {
        const { laborRequestId, documentTypeIds } = req.body;
        const userId = req.usuario.id;

        if (!laborRequestId || !documentTypeIds) {
            return res.status(400).json({ success: false, body: { message: "laborRequestId e documentTypeIds são obrigatórios." } });
        }

        const result = await laborRequestService.updateDocsRequired(
            Number(laborRequestId),
            userId,
            documentTypeIds
        );

        if (result.success) {
            return res.status(200).json({ success: true, body: result.body });
        } else {
            return res.status(400).json({ success: false, body: { message: result.body.message } });
        }
    } catch (error) {
        console.error('Erro no updateDocsRequired controller:', error);
        return res.status(500).json({ success: false, body: { message: "Erro interno do servidor." } });
    }
}
