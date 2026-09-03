import express from 'express';
import * as laborRequest from '../controllers/laborRequestController.js';
import { verificarToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// rota usada para criar uma solicitação
router.post('/create', verificarToken, laborRequest.createLaborRequest);
// lista todas solicitações
router.get('/list', verificarToken, laborRequest.listLaborRequest);
// lista uma solicitação especifica detalhada
router.get('/listById/:id', verificarToken, laborRequest.listLaborRequestById);

router.post('/updateDocsRequired', verificarToken, laborRequest.updateDocsRequired)
router.post('/approveRequest', verificarToken, laborRequest.approveRequest)
router.get('/listApprovals/:id', verificarToken, laborRequest.listApprovals)

export default router;