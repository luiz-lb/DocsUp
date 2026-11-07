import jwt from 'jsonwebtoken';
import { getSupplierJwtSecret } from '../config/jwtSecrets.js';
import * as supplierUserModel from '../models/supplierUserModel.js';
import { SUPPLIER_STATUSES } from '../constants/supplierUsers.js';

/**
 * Middleware de autenticação para fornecedores.
 * Lê o cookie `supplier_token` (separado do cookie `token` dos colaboradores) e relê o
 * usuário no banco a cada requisição: usuário inativo, fornecedor inativo / bloqueado ou
 * senha trocada depois do login (sessions_valid_after) derrubam a sessão na hora.
 *
 * Anexa a `req.fornecedor`: { supplierId, supplierUserId, role, name, email, cnpj,
 * razaoSocial, nomeFantasia }.
 */
export async function verificarTokenFornecedor(req, res, next) {
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

    // Tokens antigos (antes dos usuários do fornecedor) não têm supplierUserId: novo login
    if (decoded.type !== 'supplier' || !decoded.supplierUserId) {
        return res.status(401).json({
            success: false,
            body: { message: 'Sessão encerrada. Faça login novamente.' },
        });
    }

    let user;
    try {
        user = await supplierUserModel.getUserById(decoded.supplierUserId);
    } catch (error) {
        console.error('verificarTokenFornecedor ao buscar o usuário:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }

    const blocked = [SUPPLIER_STATUSES.INACTIVE, SUPPLIER_STATUSES.BLOCKED];
    if (!user || !user.is_active || user.supplier_id !== decoded.supplierId || blocked.includes(user.supplier_status)) {
        return res.status(401).json({
            success: false,
            body: { message: 'Acesso não permitido. Faça login novamente.' },
        });
    }

    if (user.sessions_valid_after) {
        const validAfterSeconds = Math.floor(new Date(user.sessions_valid_after).getTime() / 1000);
        if (!decoded.iat || decoded.iat < validAfterSeconds) {
            return res.status(401).json({ success: false, body: { message: 'Sessão encerrada. Faça login novamente.' } });
        }
    }

    req.fornecedor = {
        supplierId: user.supplier_id,
        supplierUserId: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
        cnpj: user.cnpj,
        razaoSocial: user.razao_social,
        nomeFantasia: user.nome_fantasia,
    };
    next();
}
