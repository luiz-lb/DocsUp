import express from 'express';
import * as laborRequest from '../controllers/laborRequestController.js';
import * as assignment from '../controllers/assignmentController.js';
import { verificarToken } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { ACCESS } from '../constants/access.js';

const router = express.Router();

// Compras (Suprimentos): indicar, reenviar, mudar o prazo e trocar o fornecedor
const podeGerenciarFornecedor = requireRole(...ACCESS.SUPPLIER_ASSIGNMENT);

// rota usada para criar uma solicitação
router.post('/create', verificarToken, laborRequest.createLaborRequest);
// lista todas solicitações
router.get('/list', verificarToken, laborRequest.listLaborRequest);
// contagem por status e urgência (painel inicial)
router.get('/summary', verificarToken, laborRequest.laborRequestSummary);
// lista uma solicitação especifica detalhada
router.get('/listById/:id', verificarToken, laborRequest.listLaborRequestById);

// aprovação e documentos exigidos do fornecedor: Segurança do Trabalho
router.post('/approveRequest', verificarToken, requireRole(...ACCESS.REQUIRED_DOCUMENTS), laborRequest.approveRequest)
router.get('/listApprovals/:id', verificarToken, laborRequest.listApprovals)

// Fornecedor da solicitação (no lugar da cotação): todos veem; Compras indica e troca
router.get('/supplier-lookup', verificarToken, podeGerenciarFornecedor, assignment.lookupSupplierEmail);
router.get('/:id/supplier', verificarToken, assignment.getRequestSupplier);
router.post('/:id/supplier', verificarToken, podeGerenciarFornecedor, assignment.assignSupplier);
router.post('/:id/supplier/resend', verificarToken, podeGerenciarFornecedor, assignment.resendInvite);
router.put('/:id/supplier/deadline', verificarToken, podeGerenciarFornecedor, assignment.changeDeadline);

export default router;
