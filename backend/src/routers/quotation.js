import express from 'express';
import * as quotationController from '../controllers/quotationController.js';
import { verificarToken } from '../middleware/authMiddleware.js';
import { verificarTokenFornecedor } from '../middleware/supplierAuthMiddleware.js';

const router = express.Router();

// ─── Painel interno (colaboradores) ───────────────────────────────────────────
// Cria rodada de cotação com convites
router.post('/rounds/create', verificarToken, quotationController.createRound);

// Busca dados de uma rodada com cotações
router.get('/rounds/:roundId', verificarToken, quotationController.getRound);

// Lista rounds de uma solicitação
router.get('/rounds/byRequest/:laborRequestId', verificarToken, quotationController.listRoundsByLaborRequest);

// Declara vencedor e inicia Phase 2
router.post('/rounds/declareWinner', verificarToken, quotationController.declareWinner);

// ─── Portal do Fornecedor ──────────────────────────────────────────────────────
// Busca dados do convite pelo token (público — para pré-carregar a tela)
router.get('/invite/:token', quotationController.getInviteByToken);

// Submete cotação (exige JWT de fornecedor)
router.post('/submit/:token', verificarTokenFornecedor, quotationController.submitQuotation);

export default router;
