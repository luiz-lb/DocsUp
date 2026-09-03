import express from 'express';
import * as documentController from '../controllers/documentController.js';
import { verificarToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Painel interno (colaboradores autenticados)
router.get('/', verificarToken, documentController.listDocuments);
router.get('/review-queue', verificarToken, documentController.listReviewQueue);
router.post('/review', verificarToken, documentController.reviewDocument);

// Webhook do N8N (autenticado por X-Webhook-Secret)
router.post('/ai-result', documentController.receiveAiResult);

export default router;
