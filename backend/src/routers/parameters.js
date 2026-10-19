import express from 'express';
import * as parametersController from '../controllers/parametersController.js';
import { verificarToken } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { DEPARTMENTS } from '../constants/departments.js';

const router = express.Router();

// Parâmetros (catálogo de documentos e atividades): só Admin, em todas as rotas abaixo
router.use(verificarToken, requireRole(DEPARTMENTS.ADMIN));

// Tipos de documento: lista (filtros category, status e search), cria, edita e ativa / inativa
router.get('/document-types', parametersController.listDocumentTypes);
router.post('/document-types', parametersController.createDocumentType);
router.put('/document-types/:id', parametersController.updateDocumentType);
router.put('/document-types/:id/status', parametersController.setDocumentTypeStatus);

// Atividades e seus documentos sugeridos: lista (filtros status e search), cria, edita e ativa / inativa
router.get('/activities', parametersController.listActivities);
router.post('/activities', parametersController.createActivity);
router.put('/activities/:id', parametersController.updateActivity);
router.put('/activities/:id/status', parametersController.setActivityStatus);

export default router;
