import { DEPARTMENTS } from '../constants/departments.js';

/**
 * Autorização por perfil (users.department). Use depois do verificarToken:
 *   router.post('/x', verificarToken, requireRole(DEPARTMENTS.SUPRIMENTOS), controller.x)
 *
 * O Admin passa em todas as checagens. Sem usuário autenticado responde 401;
 * autenticado mas sem o perfil, 403.
 */
export function requireRole(...allowedDepartments) {
    return (req, res, next) => {
        const department = req.usuario?.department;

        if (department === undefined || department === null) {
            return res.status(401).json({ success: false, body: { message: 'Acesso negado. Faça login para continuar.' } });
        }

        if (department === DEPARTMENTS.ADMIN || allowedDepartments.includes(department)) {
            return next();
        }

        return res.status(403).json({ success: false, body: { message: 'Você não tem permissão para esta ação.' } });
    };
}
