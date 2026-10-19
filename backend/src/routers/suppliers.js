import express from 'express';
import * as supplierController from '../controllers/supplierController.js';
import { verificarToken } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { ACCESS } from '../constants/access.js';

const router = express.Router();

// Painel interno — base de fornecedores (Suprimentos)
router.get('/', verificarToken, requireRole(...ACCESS.SUPPLIERS), supplierController.listSuppliers);
router.get('/:id', verificarToken, requireRole(...ACCESS.SUPPLIERS), supplierController.getSupplierDetail);

export default router;
