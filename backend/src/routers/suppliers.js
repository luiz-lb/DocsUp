import express from 'express';
import * as supplierController from '../controllers/supplierController.js';
import { verificarToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Painel interno (colaboradores autenticados) — base de fornecedores
router.get('/', verificarToken, supplierController.listSuppliers);
router.get('/:id', verificarToken, supplierController.getSupplierDetail);

export default router;
