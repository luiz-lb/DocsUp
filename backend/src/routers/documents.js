import express from 'express';
import * as documentController from '../controllers/documentController.js';
import { verificarToken } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { ACCESS } from '../constants/access.js';

const router = express.Router();

// Painel interno: documentos dos fornecedores (RH e Segurança do Trabalho; Admin passa sempre)
const podeVerDocumentos = requireRole(...ACCESS.SUPPLIER_DOCUMENTS);

router.get('/', verificarToken, podeVerDocumentos, documentController.listDocuments);
// Download: um arquivo, ou vários num ZIP (body { documentIds })
router.get('/:id/download', verificarToken, podeVerDocumentos, documentController.downloadDocument);
// Histórico de entregas do documento
router.get('/:id/history', verificarToken, podeVerDocumentos, documentController.documentHistory);
router.post('/download', verificarToken, podeVerDocumentos, documentController.downloadDocuments);
router.get('/review-queue', verificarToken, podeVerDocumentos, documentController.listReviewQueue);
router.post('/review', verificarToken, podeVerDocumentos, documentController.reviewDocument);
router.post('/set-status', verificarToken, podeVerDocumentos, documentController.setStatus);

// Webhook do N8N (autenticado por X-Webhook-Secret)
router.post('/ai-result', documentController.receiveAiResult);

export default router;
