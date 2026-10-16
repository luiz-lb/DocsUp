import * as authModel from '../models/authModel.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export async function login(email, password) {
    try {
        const { passwordHash, id, name, department, role } = await authModel.getPasswordHashAndIdByEmail(email);

        if (!passwordHash) {
            return { success: false, message: 'Usuário não encontrado.' };
        }

        const isPasswordValid = await bcrypt.compare(password, passwordHash);
        if (!isPasswordValid) {
            return { success: false, message: 'Senha incorreta.' };
        }

        // type 'user' separa o token de colaborador do token de fornecedor (type 'supplier')
        const token = jwt.sign({ type: 'user', email, id, name, department, role }, process.env.JWT_SECRET, { expiresIn: '1h' });

        return { success: true, token, id, name, department, role };
    } catch (error) {
        console.error('Erro no login service:', error);
        throw error;
    }
}

/**
 * Usuário ativo pelo id, lido do banco a cada requisição autenticada:
 * inativação e troca de departamento valem na hora, sem esperar o JWT vencer.
 * Retorna null se o usuário não existe ou está inativo.
 */
export async function getActiveUserById(id) {
    return authModel.getActiveUserById(id);
}
