import express from 'express';
import * as auth from '../controllers/authController.js';
import { verificarToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login',  auth.login);
// rota pendente de finalização
router.post('/register', auth.registerNewUser);
// rota usada para verificar token quando usuario carregar tel
router.get('/me', verificarToken, auth.getMe);

export default router;