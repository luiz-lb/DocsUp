import * as documentValidationService from '../services/documentValidationService.js';

// ─────────────────────────────────────────────
// Painel interno
// ─────────────────────────────────────────────

/** GET /documents  — lista todos os documentos com validação */
export async function listDocuments(req, res) {
    try {
        const { supplierId, laborRequestId, status } = req.query;
        const result = await documentValidationService.listAllDocuments({
            supplierId: supplierId ? Number(supplierId) : undefined,
            laborRequestId: laborRequestId ? Number(laborRequestId) : undefined,
            status: status !== undefined ? Number(status) : undefined,
        });
        if (!result.success) {
            return res.status(500).json({ success: false, body: { message: result.message } });
        }
        return res.status(200).json({ success: true, body: result.body });
    } catch (error) {
        console.error('listDocuments controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/** GET /documents/review-queue  — fila de revisão manual */
export async function listReviewQueue(req, res) {
    try {
        const result = await documentValidationService.listManualReviewQueue();
        if (!result.success) {
            return res.status(500).json({ success: false, body: { message: result.message } });
        }
        return res.status(200).json({ success: true, body: result.body });
    } catch (error) {
        console.error('listReviewQueue controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/**
 * POST /documents/review
 * Body: { validationId, documentId, decision, comments }
 * decision: 1=Aprovado, 2=Reprovado
 */
export async function reviewDocument(req, res) {
    try {
        const { validationId, documentId, decision, comments } = req.body;
        const reviewerId = req.usuario.id;

        if (!validationId || !documentId || decision === undefined) {
            return res.status(400).json({
                success: false,
                body: { message: 'validationId, documentId e decision são obrigatórios.' },
            });
        }

        const result = await documentValidationService.reviewDocument(
            Number(validationId),
            Number(documentId),
            reviewerId,
            Number(decision),
            comments,
        );

        if (!result.success) {
            return res.status(400).json({ success: false, body: { message: result.message } });
        }

        return res.status(200).json({ success: true, body: result.body });
    } catch (error) {
        console.error('reviewDocument controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/**
 * POST /documents/ai-result  — webhook do N8N com resultado da IA
 * Body: { documentId, validationId, aiScore, aiResultJson, aiModelUsed }
 * Protegido por X-Webhook-Secret para uso interno
 */
export async function receiveAiResult(req, res) {
    try {
        const webhookSecret = req.headers['x-webhook-secret'];
        if (webhookSecret !== process.env.WEBHOOK_SECRET) {
            return res.status(401).json({ success: false, body: { message: 'Acesso não autorizado.' } });
        }

        const result = await documentValidationService.receiveAiValidationResult(req.body);
        if (!result.success) {
            return res.status(400).json({ success: false, body: { message: result.message } });
        }

        return res.status(200).json({ success: true, body: result.body });
    } catch (error) {
        console.error('receiveAiResult controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}
