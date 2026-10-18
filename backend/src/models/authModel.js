// importando a configuração do banco de dados
import {sql, poolPromise} from '../config/dbConfig.js';

export async function getPasswordHashAndIdByEmail(email) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('email', sql.VarChar, email)
        .query('SELECT password_hash, id, name, department, role FROM Users WHERE email = @email AND is_active = 1');

    const record = result.recordset[0];
    return {
        passwordHash: record?.password_hash ?? null,
        id: record?.id ?? null,
        name: record?.name ?? null,
        department: record?.department ?? null,
        role: record?.role ?? null
    };
}

// Usuário ativo pelo id (usado pelo verificarToken a cada requisição)
export async function getActiveUserById(id) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT id, name, email, department, role FROM users WHERE id = @id AND is_active = 1');
    return result.recordset[0] ?? null;
}

