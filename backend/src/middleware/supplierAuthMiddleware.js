import jwt from 'jsonwebtoken';
import { getSupplierJwtSecret } from '../config/jwtSecrets.js';

/**
 * Middleware de autenticação para fornecedores.
 * Lê o cookie `supplier_token` (separado do cookie `token` dos colaboradores).
 * Anexa os dados do fornecedor a `req.fornecedor`.
 */
export function verificarTokenFornecedor(req, res, next) {
    const token = req.cookies.supplier_token;

    if (!token) {
        return res.status(401).json({
            success: false,
            body: { message: 'Acesso negado. Token de fornecedor não fornecido.' },
        });
    }

    let secret;
    try {
        secret = getSupplierJwtSecret();
    } catch (error) {
        console.error('verificarTokenFornecedor:', error.message);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    } catch (error) {
        return res.status(401).json({
            success: false,
            body: { message: 'Token de fornecedor inválido ou expirado.' },
        });
    }

    if (decoded.type !== 'supplier') {
        return res.status(401).json({
            success: false,
            body: { message: 'Token inválido para este recurso.' },
        });
    }

    req.fornecedor = decoded;
    next();
}
