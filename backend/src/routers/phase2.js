import express from 'express';
import * as phase2Controller from '../controllers/phase2Controller.js';
import { verificarToken } from '../middleware/authMiddleware.js';
import { verificarTokenFornecedor } from '../middleware/supplierAuthMiddleware.js';

const router = express.Router();

// Portal do fornecedor — busca dados da Fase 2 pelo token (público)
router.get('/:token', phase2Controller.getPhase2);

// Portal do fornecedor — adiciona funcionário com documentos (exige JWT fornecedor)
router.post(
    '/:token/employee',
    verificarTokenFornecedor,
    phase2Controller.uploadMiddleware,
    phase2Controller.addEmployee,
);

// Portal do fornecedor — envia documentos da EMPRESA (exige JWT fornecedor)
router.post(
    '/:token/company-documents',
    verificarTokenFornecedor,
    phase2Controller.uploadMiddleware,
    phase2Controller.addCompanyDocuments,
);

// Painel interno — lista todos os funcionários enviados (exige JWT colaborador)
router.get('/employees/list', verificarToken, phase2Controller.listEmployees);

export default router;
