import express from 'express';
import * as auth from '../controllers/authController.js';
import { verificarToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login',  auth.login);
// encerra a sessão: apaga o cookie do JWT (funciona mesmo com o token já expirado)
router.post('/logout', auth.logout);
// rota usada para verificar token quando usuario carregar tel
router.get('/me', verificarToken, auth.getMe);

export default router;
