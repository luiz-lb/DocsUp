import express from 'express';
import * as docRequired from '../controllers/docRequiredController.js';
import { verificarToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Rotas internas (colaboradores autenticados) ────────────────────────────
router.get('/activity_types',  verificarToken, docRequired.activityTypes);
router.get('/nr_types',        verificarToken, docRequired.nr_types);
router.get('/document_types',  verificarToken, docRequired.document_types);
// Básicos e outros do colaborador (painel de aprovação da Segurança do Trabalho)
router.get('/employee_document_types', verificarToken, docRequired.employee_document_types);

export default router;
