import express from 'express';
import * as phase2Controller from '../controllers/phase2Controller.js';
import { verificarToken } from '../middleware/authMiddleware.js';
import { verificarTokenFornecedor } from '../middleware/supplierAuthMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { ACCESS } from '../constants/access.js';

const router = express.Router();

// Portal do fornecedor — solicitações em que ele tem link da Fase 2 (menu "Documentos (Fase 2)")
router.get('/supplier/requests', verificarTokenFornecedor, phase2Controller.listMyRequests);

// Portal do fornecedor — busca dados da Fase 2 pelo token (exige JWT fornecedor: só o dono do link)
router.get('/:token', verificarTokenFornecedor, phase2Controller.getPhase2);

// Portal do fornecedor — baixa um arquivo que ele mesmo enviou nesta solicitação (exige JWT fornecedor)
router.get('/:token/documents/:documentId/download', verificarTokenFornecedor, phase2Controller.downloadDocument);

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

// Painel interno — lista todos os funcionários enviados (RH, Segurança do Trabalho e Obra)
router.get('/employees/list', verificarToken, requireRole(...ACCESS.EMPLOYEES), phase2Controller.listEmployees);

export default router;
