import crypto from 'crypto';
import archiver from 'archiver';
import * as documentValidationService from '../services/documentValidationService.js';
import * as documentDownloadService from '../services/documentDownloadService.js';
import * as deliveryService from '../services/deliveryService.js';
import { requestAuditContext } from '../utils/audit.js';
import { sendPrivateFile, setPrivateFileHeaders } from '../utils/fileResponse.js';

/**
 * Confere o X-Webhook-Secret em tempo constante.
 * Sem WEBHOOK_SECRET configurado, recusa tudo (antes, a rota ficava aberta).
 */
function isValidWebhookSecret(received) {
    const expected = process.env.WEBHOOK_SECRET;
    if (!expected) {
        console.error('[Webhook] WEBHOOK_SECRET não configurado: requisição recusada.');
        return false;
    }
    if (typeof received !== 'string') return false;

    const receivedBuffer = Buffer.from(received);
    const expectedBuffer = Buffer.from(expected);
    return receivedBuffer.length === expectedBuffer.length
        && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

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

/**
 * GET /documents/:id/history  — histórico de entregas do documento (RH, Segurança e Admin):
 * data de entrega, validade, arquivo, status (Análise) e observação de cada entrega.
 */
export async function documentHistory(req, res) {
    try {
        const documentId = Number(req.params.id);
        if (!Number.isInteger(documentId) || documentId <= 0) {
            return res.status(400).json({ success: false, body: { message: 'Documento inválido.' } });
        }

        const result = await deliveryService.getDocumentHistory(documentId);
        if (!result.success) {
            return res.status(result.status ?? 400).json({ success: false, body: { message: result.message } });
        }
        return res.status(200).json({ success: true, body: result.body });
    } catch (error) {
        console.error('documentHistory controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/**
 * GET /documents/:id/download  — baixa o arquivo de um documento (Admin, RH e Segurança).
 * Vai com o nome original; o caminho no servidor não aparece. Registra na auditoria.
 */
export async function downloadDocument(req, res) {
    try {
        const documentId = Number(req.params.id);
        if (!Number.isInteger(documentId) || documentId <= 0) {
            return res.status(400).json({ success: false, body: { message: 'Documento inválido.' } });
        }

        const result = await documentDownloadService.prepareDocumentDownload(documentId, requestAuditContext(req));
        if (!result.success) {
            return res.status(result.status ?? 400).json({ success: false, body: { message: result.message } });
        }

        return sendPrivateFile(res, result.body.absolutePath, result.body.fileName, 'downloadDocument');
    } catch (error) {
        console.error('downloadDocument controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/**
 * POST /documents/download  — baixa vários documentos num ZIP (Admin, RH e Segurança).
 * Body: { documentIds: number[] }. O ZIP é montado enquanto é enviado (sem carregar
 * todos os arquivos na memória). Registra um item na auditoria com a lista.
 */
export async function downloadDocuments(req, res) {
    try {
        const result = await documentDownloadService.prepareZipDownload(req.body?.documentIds, requestAuditContext(req));
        if (!result.success) {
            return res.status(result.status ?? 400).json({ success: false, body: { message: result.message } });
        }

        const { zipName, entries, missingText, missingFileName } = result.body;

        setPrivateFileHeaders(res);
        res.attachment(zipName);

        // statConcurrency 1: os arquivos entram no ZIP na ordem da lista (fornecedor, solicitação...)
        const archive = archiver('zip', { zlib: { level: 6 }, statConcurrency: 1 });
        archive.on('warning', (warning) => console.warn('downloadDocuments: aviso do ZIP:', warning.message));
        archive.on('error', (error) => {
            console.error('downloadDocuments: erro ao gerar o ZIP:', error);
            res.destroy(error);
        });
        // Quem baixava fechou a conexão: para de montar o ZIP
        res.on('close', () => {
            if (!res.writableFinished) archive.abort();
        });

        archive.pipe(res);
        for (const entry of entries) {
            archive.file(entry.absolutePath, { name: entry.name });
        }
        if (missingText) {
            archive.append(missingText, { name: missingFileName });
        }
        await archive.finalize();
    } catch (error) {
        console.error('downloadDocuments controller error:', error);
        if (!res.headersSent) {
            return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
        }
        res.destroy(error);
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
 * POST /documents/set-status
 * Body: { documentId, status (0..5), comments? }
 * RH / Segurança do Trabalho define o status da entrega atual do documento. Reprovado (3) e
 * Reenvio Necessário (4) exigem comments (a observação que o fornecedor vê).
 */
export async function setStatus(req, res) {
    try {
        const { documentId, status, comments } = req.body ?? {};

        if (!documentId || status === undefined) {
            return res.status(400).json({
                success: false,
                body: { message: 'documentId e status são obrigatórios.' },
            });
        }

        const result = await documentValidationService.setDocumentStatus(
            Number(documentId),
            Number(status),
            { id: req.usuario.id, department: req.usuario.department },
            comments,
            requestAuditContext(req),
        );

        if (!result.success) {
            return res.status(result.status ?? 400).json({ success: false, body: { message: result.message } });
        }

        return res.status(200).json({ success: true, body: result.body });
    } catch (error) {
        console.error('setStatus controller error:', error);
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
        if (!isValidWebhookSecret(req.headers['x-webhook-secret'])) {
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
