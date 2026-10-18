import express from 'express';
import * as userController from '../controllers/userController.js';
import { verificarToken } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { DEPARTMENTS } from '../constants/departments.js';

const router = express.Router();

// Gestão de usuários internos: só Admin, em todas as rotas abaixo
router.use(verificarToken, requireRole(DEPARTMENTS.ADMIN));

// lista com busca, filtros e paginação
router.get('/', userController.listUsers);
// cria usuário (senha com hash)
router.post('/', userController.createUser);
// edita nome, e-mail e departamento
router.put('/:id', userController.updateUser);
// ativa / inativa (não existe exclusão)
router.put('/:id/status', userController.setUserStatus);
// redefine a senha
router.put('/:id/password', userController.resetUserPassword);

export default router;
