import * as assignmentService from '../services/assignmentService.js';
import { requestAuditContext } from '../utils/audit.js';

function laborRequestIdFrom(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ success: false, body: { message: 'Solicitação inválida.' } });
        return null;
    }
    return id;
}

function reply(res, result, successStatus = 200) {
    if (!result.success) {
        return res.status(result.status ?? 400).json({ success: false, body: { message: result.message } });
    }
    return res.status(successStatus).json({ success: true, body: result.body });
}

/** GET /laborRequest/:id/supplier — fornecedor da solicitação (vínculo, declaração e histórico). */
export async function getRequestSupplier(req, res) {
    try {
        const id = laborRequestIdFrom(req, res);
        if (id === null) return undefined;
        return reply(res, await assignmentService.getRequestSupplier(id, req.usuario));
    } catch (error) {
        console.error('getRequestSupplier controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/** GET /laborRequest/supplier-lookup?email= — o e-mail já tem cadastro no portal? (Compras) */
export async function lookupSupplierEmail(req, res) {
    try {
        return reply(res, await assignmentService.lookupSupplierEmail(req.query.email));
    } catch (error) {
        console.error('lookupSupplierEmail controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/** POST /laborRequest/:id/supplier — indica o fornecedor. Body: { email, deadlineHours? | deadlineAt? } */
export async function assignSupplier(req, res) {
    try {
        const id = laborRequestIdFrom(req, res);
        if (id === null) return undefined;
        const result = await assignmentService.assignSupplier(id, req.body ?? {}, req.usuario, requestAuditContext(req));
        return reply(res, result, 201);
    } catch (error) {
        console.error('assignSupplier controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/** POST /laborRequest/:id/supplier/resend — reenvia ao mesmo e-mail. Body: { deadlineHours? | deadlineAt? } */
export async function resendInvite(req, res) {
    try {
        const id = laborRequestIdFrom(req, res);
        if (id === null) return undefined;
        const result = await assignmentService.resendInvite(id, req.body ?? {}, req.usuario, requestAuditContext(req));
        return reply(res, result, 201);
    } catch (error) {
        console.error('resendInvite controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/** PUT /laborRequest/:id/supplier/deadline — novo prazo. Body: { deadlineHours? | deadlineAt? } */
export async function changeDeadline(req, res) {
    try {
        const id = laborRequestIdFrom(req, res);
        if (id === null) return undefined;
        const result = await assignmentService.changeDeadline(id, req.body ?? {}, req.usuario, requestAuditContext(req));
        return reply(res, result);
    } catch (error) {
        console.error('changeDeadline controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/**
 * POST /laborRequest/:id/supplier/replace — troca o fornecedor.
 * Body: { email, reason, deadlineHours? | deadlineAt? }
 */
export async function replaceSupplier(req, res) {
    try {
        const id = laborRequestIdFrom(req, res);
        if (id === null) return undefined;
        const result = await assignmentService.replaceSupplier(id, req.body ?? {}, req.usuario, requestAuditContext(req));
        return reply(res, result, 201);
    } catch (error) {
        console.error('replaceSupplier controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/**
 * GET /laborRequest/:id/supplier/declaration.pdf?assignment=<id> — PDF da declaração do
 * fornecedor (o atual, ou um vínculo do histórico). Fica na auditoria.
 */
export async function downloadDeclarationPdf(req, res) {
    try {
        const id = laborRequestIdFrom(req, res);
        if (id === null) return undefined;
        const assignmentParam = req.query.assignment;
        const assignmentId = assignmentParam === undefined || assignmentParam === '' ? null : Number(assignmentParam);
        if (assignmentId !== null && (!Number.isInteger(assignmentId) || assignmentId <= 0)) {
            return res.status(400).json({ success: false, body: { message: 'Fornecedor inválido.' } });
        }
        const result = await assignmentService.getDeclarationPdf(id, assignmentId, requestAuditContext(req));
        if (!result.success) {
            return res.status(result.status ?? 400).json({ success: false, body: { message: result.message } });
        }
        res.attachment(result.body.fileName);
        res.type('application/pdf');
        res.setHeader('Cache-Control', 'no-store');
        return res.send(result.body.buffer);
    } catch (error) {
        console.error('downloadDeclarationPdf controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}
