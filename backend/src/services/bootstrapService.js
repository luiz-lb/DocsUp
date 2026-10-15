import crypto from 'crypto';
import bcrypt from 'bcrypt';
import * as authModel from '../models/authModel.js';

// users.department: 6 = Admin (espelhado em DEPARTMENT no frontend)
const ADMIN_DEPARTMENT = 6;
const ADMIN_ROLE = 'ADMIN';
const ADMIN_NAME = 'Administrador';
const MIN_PASSWORD_LENGTH = 8;

// Violação de UNIQUE/PK no SQL Server (outra instância criou o mesmo e-mail ao mesmo tempo)
const SQL_DUPLICATE_KEY_ERRORS = [2601, 2627];

/**
 * Cria o usuário Admin inicial a partir de USER_ADMIN (e-mail) e SENHA_ADMIN.
 *
 * Idempotente: se já existe usuário com esse e-mail (ativo ou não), não faz nada.
 * Em especial, NÃO redefine a senha: trocar SENHA_ADMIN depois não altera o Admin.
 */
export async function ensureInitialAdmin() {
    const email = process.env.USER_ADMIN?.trim();
    const password = process.env.SENHA_ADMIN;

    if (!email || !password) {
        console.log('[Bootstrap] USER_ADMIN/SENHA_ADMIN não definidos: Admin inicial não será criado.');
        return;
    }

    if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
        console.error('[Bootstrap] USER_ADMIN precisa ser um e-mail válido: Admin inicial não criado.');
        return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
        console.error(`[Bootstrap] SENHA_ADMIN precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres: Admin inicial não criado.`);
        return;
    }

    const existingId = await authModel.getUserIdByEmailAnyStatus(email);
    if (existingId) {
        console.log('[Bootstrap] Admin inicial já existe: nada a fazer.');
        return;
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const result = await authModel.insertUser({
            uid: crypto.randomUUID(),
            name: ADMIN_NAME,
            email,
            // insertUser declara department como VarChar; o SQL Server converte para TINYINT
            department: String(ADMIN_DEPARTMENT),
            role: ADMIN_ROLE,
            passwordHash,
        });
        console.log(`[Bootstrap] Admin inicial criado (id ${result.id}).`);
    } catch (error) {
        if (SQL_DUPLICATE_KEY_ERRORS.includes(error.number)) {
            console.log('[Bootstrap] Admin inicial já foi criado por outra instância.');
            return;
        }
        throw error;
    }
}
