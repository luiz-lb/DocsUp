import jwt from 'jsonwebtoken';

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

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.type !== 'supplier') {
            return res.status(401).json({
                success: false,
                body: { message: 'Token inválido para este recurso.' },
            });
        }

        req.fornecedor = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            body: { message: 'Token de fornecedor inválido ou expirado.' },
        });
    }
}
