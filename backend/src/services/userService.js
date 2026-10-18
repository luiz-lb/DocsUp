import bcrypt from 'bcrypt';
import * as userModel from '../models/userModel.js';
import { DEPARTMENT_IDS } from '../constants/departments.js';
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

export async function createUser(payload = {}) {
    const { data, error } = validateUserData(payload);
    if (error) return { success: false, status: 400, message: error };

    const passwordError = getPasswordPolicyError(payload.password);
    if (passwordError) return { success: false, status: 400, message: passwordError };

    try {
        if (await userModel.getUserIdByEmail(data.email)) return EMAIL_IN_USE;

        const passwordHash = await bcrypt.hash(payload.password, 10);
        const id = await userModel.insertUser({ ...data, passwordHash });
        const user = await userModel.getUserById(id);

        console.log(`Usuário ${id} criado.`);
        return { success: true, body: { message: 'Usuário criado com sucesso.', user } };
    } catch (error) {
        if (SQL_DUPLICATE_KEY_ERRORS.includes(error.number)) return EMAIL_IN_USE;
        console.error('Erro no createUser service:', error);
        return { success: false, status: 500, message: 'Erro ao criar usuário.' };
    }
}

export async function updateUser(id, payload = {}) {
    const { data, error } = validateUserData(payload);
    if (error) return { success: false, status: 400, message: error };

    try {
        if (!(await userModel.getUserById(id))) return USER_NOT_FOUND;

        const emailOwnerId = await userModel.getUserIdByEmail(data.email);
        if (emailOwnerId && emailOwnerId !== id) return EMAIL_IN_USE;

        await userModel.updateUser(id, data);
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
export async function setUserStatus(id, isActive) {
    if (typeof isActive !== 'boolean') {
        return { success: false, status: 400, message: 'Informe se o usuário fica ativo (true) ou inativo (false).' };
    }

    try {
        if (!(await userModel.getUserById(id))) return USER_NOT_FOUND;

        await userModel.setUserActive(id, isActive);
        const user = await userModel.getUserById(id);

        console.log(`Usuário ${id} ${isActive ? 'ativado' : 'inativado'}.`);
        return {
            success: true,
            body: { message: isActive ? 'Usuário ativado.' : 'Usuário inativado.', user },
        };
    } catch (error) {
        console.error('Erro no setUserStatus service:', error);
        return { success: false, status: 500, message: 'Erro ao alterar o status do usuário.' };
    }
}

export async function resetUserPassword(id, password) {
    const passwordError = getPasswordPolicyError(password);
    if (passwordError) return { success: false, status: 400, message: passwordError };

    try {
        if (!(await userModel.getUserById(id))) return USER_NOT_FOUND;

        const passwordHash = await bcrypt.hash(password, 10);
        await userModel.updateUserPassword(id, passwordHash);

        console.log(`Senha do usuário ${id} redefinida.`);
        return { success: true, body: { message: 'Senha redefinida com sucesso.' } };
    } catch (error) {
        console.error('Erro no resetUserPassword service:', error);
        return { success: false, status: 500, message: 'Erro ao redefinir a senha.' };
    }
}
