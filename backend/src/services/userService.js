import bcrypt from 'bcrypt';
import * as userModel from '../models/userModel.js';
import * as auditModel from '../models/auditModel.js';
import * as trasaction from '../models/trasaction.js';
import { DEPARTMENT_IDS } from '../constants/departments.js';
import { AUDIT_ACTIONS, AUDIT_ACTOR_TYPES, AUDIT_ENTITIES } from '../constants/audit.js';
import { getPasswordPolicyError } from '../utils/passwordPolicy.js';

const NAME_MAX_LENGTH = 200;
const EMAIL_MAX_LENGTH = 200;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Violação de UNIQUE no SQL Server (dois cadastros com o mesmo e-mail ao mesmo tempo)
const SQL_DUPLICATE_KEY_ERRORS = [2601, 2627];

const EMAIL_IN_USE = { success: false, status: 409, message: 'Já existe um usuário com este e-mail.' };
const USER_NOT_FOUND = { success: false, status: 404, message: 'Usuário não encontrado.' };

/**
 * Valida e normaliza nome, e-mail e departamento.
 * Retorna { data } ou { error }.
 */
function validateUserData({ name, email, department } = {}) {
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName) return { error: 'Informe o nome.' };
    if (cleanName.length > NAME_MAX_LENGTH) return { error: `O nome pode ter no máximo ${NAME_MAX_LENGTH} caracteres.` };

    const cleanEmail = typeof email === 'string' ? email.trim() : '';
    if (!EMAIL_PATTERN.test(cleanEmail)) return { error: 'Informe um e-mail válido.' };
    if (cleanEmail.length > EMAIL_MAX_LENGTH) return { error: `O e-mail pode ter no máximo ${EMAIL_MAX_LENGTH} caracteres.` };

    // Aceita número ou texto numérico ("6", vindo de <select>); qualquer outra coisa é inválida
    const departmentId = typeof department === 'number' || (typeof department === 'string' && /^\d+$/.test(department))
        ? Number(department)
        : NaN;
    if (!DEPARTMENT_IDS.includes(departmentId)) {
        return { error: 'Selecione um departamento válido.' };
    }

    return { data: { name: cleanName, email: cleanEmail, department: departmentId } };
}

// ─────────────────────────────────────────────
// Auditoria
// ─────────────────────────────────────────────

// Campos do usuário que entram na auditoria (nunca senha nem hash)
function auditSnapshot(user) {
    return {
        name: user.name,
        email: user.email,
        department: user.department,
        is_active: Boolean(user.is_active),
    };
}

// Só os campos que mudaram: { oldValues, newValues }, ou null se nada mudou
function changedFields(before, after) {
    const oldValues = {};
    const newValues = {};
    for (const key of Object.keys(after)) {
        if (before[key] !== after[key]) {
            oldValues[key] = before[key];
            newValues[key] = after[key];
        }
    }
    return Object.keys(newValues).length > 0 ? { oldValues, newValues } : null;
}

/**
 * Monta o registro de auditoria de uma ação do Admin sobre um usuário.
 * `context` vem do controller: { actorId, ipAddress, userAgent }.
 */
function userAuditEntry(context, action, userId, oldValues, newValues) {
    return {
        actorType: AUDIT_ACTOR_TYPES.COLLABORATOR,
        actorId: context.actorId ?? null,
        action,
        entityType: AUDIT_ENTITIES.USER,
        entityId: userId,
        oldValues,
        newValues,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
    };
}

// ─────────────────────────────────────────────
// Casos de uso
// ─────────────────────────────────────────────

export async function listUsers({ page = 1, limit = 10, search = '', department, isActive } = {}) {
    try {
        const { rows, total } = await userModel.listUsers({ page, limit, search, department, isActive });
        const totalPages = total > 0 ? Math.ceil(total / limit) : 1;

        return {
            success: true,
            body: {
                message: 'Usuários listados com sucesso.',
                result: rows,
                pagination: { page, limit, total, totalPages },
            },
        };
    } catch (error) {
        console.error('Erro no listUsers service:', error);
        return { success: false, status: 500, message: 'Erro ao buscar usuários.' };
    }
}

export async function createUser(payload = {}, context = {}) {
    const { data, error } = validateUserData(payload);
    if (error) return { success: false, status: 400, message: error };

    const passwordError = getPasswordPolicyError(payload.password);
    if (passwordError) return { success: false, status: 400, message: passwordError };

    try {
        if (await userModel.getUserIdByEmail(data.email)) return EMAIL_IN_USE;

        const passwordHash = await bcrypt.hash(payload.password, 10);

        // Usuário e auditoria na mesma transação: sem auditoria, sem usuário
        const id = await trasaction.executarEmTransacao(async (transaction) => {
            const newId = await userModel.insertUser(transaction, { ...data, passwordHash });
            await auditModel.insertAuditLog(transaction, userAuditEntry(
                context, AUDIT_ACTIONS.USER_CREATE, newId, null, { ...data, is_active: true },
            ));
            return newId;
        });

        const user = await userModel.getUserById(id);
        console.log(`Usuário ${id} criado.`);
        return { success: true, body: { message: 'Usuário criado com sucesso.', user } };
    } catch (error) {
        if (SQL_DUPLICATE_KEY_ERRORS.includes(error.number)) return EMAIL_IN_USE;
        console.error('Erro no createUser service:', error);
        return { success: false, status: 500, message: 'Erro ao criar usuário.' };
    }
}

export async function updateUser(id, payload = {}, context = {}) {
    const { data, error } = validateUserData(payload);
    if (error) return { success: false, status: 400, message: error };

    try {
        const before = await userModel.getUserById(id);
        if (!before) return USER_NOT_FOUND;

        const emailOwnerId = await userModel.getUserIdByEmail(data.email);
        if (emailOwnerId && emailOwnerId !== id) return EMAIL_IN_USE;

        const changes = changedFields(auditSnapshot(before), { ...auditSnapshot(before), ...data });
        if (!changes) {
            return { success: true, body: { message: 'Nenhuma alteração para salvar.', user: before } };
        }

        await trasaction.executarEmTransacao(async (transaction) => {
            await userModel.updateUser(transaction, id, data);
            await auditModel.insertAuditLog(transaction, userAuditEntry(
                context, AUDIT_ACTIONS.USER_UPDATE, id, changes.oldValues, changes.newValues,
            ));
        });

        const user = await userModel.getUserById(id);
        console.log(`Usuário ${id} atualizado.`);
        return { success: true, body: { message: 'Usuário atualizado com sucesso.', user } };
    } catch (error) {
        if (SQL_DUPLICATE_KEY_ERRORS.includes(error.number)) return EMAIL_IN_USE;
        console.error('Erro no updateUser service:', error);
        return { success: false, status: 500, message: 'Erro ao atualizar usuário.' };
    }
}

/**
 * Ativa ou inativa um usuário. Inativo não consegue logar, e as sessões abertas
 * caem na próxima requisição (o verificarToken confere is_active no banco).
 */
export async function setUserStatus(id, isActive, context = {}) {
    if (typeof isActive !== 'boolean') {
        return { success: false, status: 400, message: 'Informe se o usuário fica ativo (true) ou inativo (false).' };
    }

    try {
        const before = await userModel.getUserById(id);
        if (!before) return USER_NOT_FOUND;

        // Já está no status pedido: nada a gravar nem auditar
        if (Boolean(before.is_active) !== isActive) {
            await trasaction.executarEmTransacao(async (transaction) => {
                await userModel.setUserActive(transaction, id, isActive);
                await auditModel.insertAuditLog(transaction, userAuditEntry(
                    context,
                    isActive ? AUDIT_ACTIONS.USER_ACTIVATE : AUDIT_ACTIONS.USER_INACTIVATE,
                    id,
                    { is_active: !isActive },
                    { is_active: isActive },
                ));
            });
            console.log(`Usuário ${id} ${isActive ? 'ativado' : 'inativado'}.`);
        }

        const user = await userModel.getUserById(id);
        return {
            success: true,
            body: { message: isActive ? 'Usuário ativado.' : 'Usuário inativado.', user },
        };
    } catch (error) {
        console.error('Erro no setUserStatus service:', error);
        return { success: false, status: 500, message: 'Erro ao alterar o status do usuário.' };
    }
}

/**
 * Redefine a senha e encerra as sessões abertas do usuário (sessions_valid_after).
 * O instante é alinhado ao segundo porque o iat do JWT tem precisão de segundo:
 * um token emitido logo depois, no mesmo segundo, continua valendo.
 */
export async function resetUserPassword(id, password, context = {}) {
    const passwordError = getPasswordPolicyError(password);
    if (passwordError) return { success: false, status: 400, message: passwordError };

    try {
        if (!(await userModel.getUserById(id))) return USER_NOT_FOUND;

        const sessionsValidAfter = new Date(Math.floor(Date.now() / 1000) * 1000);
        const passwordHash = await bcrypt.hash(password, 10);

        await trasaction.executarEmTransacao(async (transaction) => {
            await userModel.updateUserPassword(transaction, id, passwordHash, sessionsValidAfter);
            await auditModel.insertAuditLog(transaction, userAuditEntry(
                context, AUDIT_ACTIONS.USER_PASSWORD_RESET, id, null, { sessions_ended: true },
            ));
        });

        console.log(`Senha do usuário ${id} redefinida (sessões encerradas).`);
        return {
            success: true,
            body: { message: 'Senha redefinida. As sessões abertas desse usuário foram encerradas.' },
        };
    } catch (error) {
        console.error('Erro no resetUserPassword service:', error);
        return { success: false, status: 500, message: 'Erro ao redefinir a senha.' };
    }
}
