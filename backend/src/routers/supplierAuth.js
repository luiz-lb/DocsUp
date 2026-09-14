import express from 'express';
import * as supplierAuth from '../controllers/supplierAuthController.js';
import { verificarTokenFornecedor } from '../middleware/supplierAuthMiddleware.js';

const router = express.Router();

// Rotas públicas (sem autenticação)
router.post('/validate-cnpj', supplierAuth.validateCnpj);
router.post('/register', supplierAuth.register);
router.post('/login', supplierAuth.login);
router.post('/verify-mfa', supplierAuth.verifyMfa);
router.post('/logout', supplierAuth.logout);

// Rota protegida — retorna dados do fornecedor logado
router.get('/me', verificarTokenFornecedor, supplierAuth.getMe);

// Perfil do fornecedor (edição de dados da empresa)
router.get('/profile', verificarTokenFornecedor, supplierAuth.getProfile);
router.put('/profile', verificarTokenFornecedor, supplierAuth.updateProfile);

export default router;
