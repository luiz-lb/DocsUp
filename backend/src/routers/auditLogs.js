import express from 'express';
import * as auditController from '../controllers/auditController.js';
import { verificarToken } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { DEPARTMENTS } from '../constants/departments.js';

const router = express.Router();

// Consulta da auditoria: só Admin
router.get('/', verificarToken, requireRole(DEPARTMENTS.ADMIN), auditController.listAuditLogs);

export default router;
