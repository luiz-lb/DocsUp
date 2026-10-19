import express from 'express';
import * as laborRequest from '../controllers/laborRequestController.js';
import { verificarToken } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { ACCESS } from '../constants/access.js';

const router = express.Router();

// rota usada para criar uma solicitação
router.post('/create', verificarToken, laborRequest.createLaborRequest);
// lista todas solicitações
router.get('/list', verificarToken, laborRequest.listLaborRequest);
// lista uma solicitação especifica detalhada
router.get('/listById/:id', verificarToken, laborRequest.listLaborRequestById);

// aprovação e documentos exigidos do fornecedor: Segurança do Trabalho
router.post('/updateDocsRequired', verificarToken, requireRole(...ACCESS.REQUIRED_DOCUMENTS), laborRequest.updateDocsRequired)
router.post('/approveRequest', verificarToken, requireRole(...ACCESS.REQUIRED_DOCUMENTS), laborRequest.approveRequest)
router.get('/listApprovals/:id', verificarToken, laborRequest.listApprovals)

export default router;