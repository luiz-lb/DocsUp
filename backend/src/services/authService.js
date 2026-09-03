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
        
        const token = jwt.sign({ email, id, name, department, role }, process.env.JWT_SECRET, { expiresIn: '1h' });

        return { success: true, token, id, name, department, role };
    } catch (error) {
        console.error('Erro no login service:', error);
        throw error;
    }
}

export async function registerNewUser({ name, email, departament, role, password }) {
    try {
        const existingUser = await authModel.getUserByEmail(email);
        if (existingUser) {
            return { success: false, message: 'Email já cadastrado.' };
        }

        const uid = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
        const passwordHash = await bcrypt.hash(password, 10);

        const result = await authModel.insertUser({ uid: uid, name, email, department: departament, role, passwordHash });

        if (!result || result.rowsAffected === 0 || !result.id) {
            return { success: false, message: 'Erro ao registrar usuário.' };
        }

        const token = jwt.sign({ email, id: result.id }, process.env.JWT_SECRET, { expiresIn: '1h' }); 

        return { success: true, id: result.id, token };
    } catch (error) {
        console.error('Erro no register service:', error);
        throw error;
    }
}