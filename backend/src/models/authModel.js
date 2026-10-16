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

// Busca o id pelo email sem filtrar is_active (usuário inativo também conta como existente)
export async function getUserIdByEmailAnyStatus(email) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('email', sql.NVarChar(200), email)
        .query('SELECT id FROM users WHERE email = @email');
    return result.recordset[0]?.id ?? null;
}

export async function insertUser({ uid, name, email, department, role, passwordHash }) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('uid', sql.UniqueIdentifier, uid)
        .input('name', sql.VarChar, name)
        .input('email', sql.VarChar, email)
        .input('department', sql.VarChar, department)
        .input('role', sql.VarChar, role)
        .input('passwordHash', sql.VarChar, passwordHash)
        .query(
            `INSERT INTO Users (uid, name, email, department, role, password_hash, is_active)
             OUTPUT INSERTED.id
             VALUES (@uid, @name, @email, @department, @role, @passwordHash, 1)`
        );
    return { rowsAffected: result.rowsAffected[0], id: result.recordset[0].id };
}