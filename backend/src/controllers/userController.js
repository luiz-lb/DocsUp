import * as userService from '../services/userService.js';
import * as authService from '../services/authService.js';
import { COLLABORATOR_COOKIE_OPTIONS } from '../config/authCookies.js';

const ALLOWED_PAGE_SIZES = [10, 25, 50, 100];

function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

// Quem fez a ação e de onde, para a auditoria. Atrás de proxy, req.ip depende do TRUST_PROXY.
function auditContext(req) {
    return {
        actorId: req.usuario?.id ?? null,
        ipAddress: req.ip ? req.ip.replace(/^::ffff:/, '') : null,
        userAgent: req.headers['user-agent'] ?? null,
    };
}

// Converte o resultado do service em resposta HTTP (o service informa o status do erro)
function sendResult(res, result, successStatus = 200) {
    if (result.success) {
        return res.status(successStatus).json({ success: true, body: result.body });
    }
    return res.status(result.status ?? 400).json({ success: false, body: { message: result.message } });
}

/**
 * GET /users?page=1&limit=10&search=texto&department=6&status=1
 * status: 1 = ativos, 0 = inativos, vazio = todos.
 */
export async function listUsers(req, res) {
    try {
        const { page: pageParam, limit: limitParam, search: searchParam, department: departmentParam, status: statusParam } = req.query;

        const page = Math.max(Number.parseInt(pageParam, 10) || 1, 1);
        const parsedLimit = Number.parseInt(limitParam, 10);
        const limit = ALLOWED_PAGE_SIZES.includes(parsedLimit) ? parsedLimit : 10;
        const search = typeof searchParam === 'string' ? searchParam.trim().slice(0, 200) : '';

        let department;
        if (departmentParam !== undefined && departmentParam !== '') {
            department = Number.parseInt(departmentParam, 10);
            if (Number.isNaN(department)) {
                return res.status(400).json({ success: false, body: { message: 'department deve ser um número válido.' } });
            }
        }

        let isActive;
        if (statusParam !== undefined && statusParam !== '') {
            if (statusParam !== '0' && statusParam !== '1') {
                return res.status(400).json({ success: false, body: { message: 'status deve ser 1 (ativos) ou 0 (inativos).' } });
            }
            isActive = statusParam === '1';
        }

        const result = await userService.listUsers({ page, limit, search, department, isActive });
        return sendResult(res, result);
    } catch (error) {
        console.error('Erro no listUsers controller:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/** POST /users  Body: { name, email, department, password } */
export async function createUser(req, res) {
    try {
        const { name, email, department, password } = req.body ?? {};
        const result = await userService.createUser({ name, email, department, password }, auditContext(req));
        return sendResult(res, result, 201);
    } catch (error) {
        console.error('Erro no createUser controller:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/** PUT /users/:id  Body: { name, email, department } */
export async function updateUser(req, res) {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json({ success: false, body: { message: 'Id de usuário inválido.' } });
        }

        const { name, email, department } = req.body ?? {};
        const result = await userService.updateUser(id, { name, email, department }, auditContext(req));
        return sendResult(res, result);
    } catch (error) {
        console.error('Erro no updateUser controller:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/** PUT /users/:id/status  Body: { isActive: boolean } */
export async function setUserStatus(req, res) {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json({ success: false, body: { message: 'Id de usuário inválido.' } });
        }

        const result = await userService.setUserStatus(id, req.body?.isActive, auditContext(req));
        return sendResult(res, result);
    } catch (error) {
        console.error('Erro no setUserStatus controller:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/** PUT /users/:id/password  Body: { password } */
export async function resetUserPassword(req, res) {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json({ success: false, body: { message: 'Id de usuário inválido.' } });
        }

        const result = await userService.resetUserPassword(id, req.body?.password, auditContext(req));

        // A redefinição encerra as sessões do usuário. Se o Admin redefiniu a própria senha,
        // emite um cookie novo: esta sessão continua e as outras dele caem.
        if (result.success && id === req.usuario.id) {
            res.cookie('token', authService.signUserToken(req.usuario), COLLABORATOR_COOKIE_OPTIONS);
        }

        return sendResult(res, result);
    } catch (error) {
        console.error('Erro no resetUserPassword controller:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}
