// importando a configuração do banco de dados
import { sql, poolPromise } from '../config/dbConfig.js';

// Campos devolvidos pela API (nunca o password_hash). is_active nulo conta como inativo,
// igual ao login, que só aceita is_active = 1.
const USER_FIELDS = `
    id,
    [name],
    email,
    department,
    [role],
    CAST(ISNULL(is_active, 0) AS BIT) AS is_active,
    created_at
`;

/**
 * Lista usuários com paginação, busca (nome/e-mail) e filtros.
 *
 * @param {object} options
 * @param {number} options.page        - Página (1-based).
 * @param {number} options.limit       - Itens por página.
 * @param {string} options.search      - Busca livre por nome ou e-mail.
 * @param {number} [options.department] - Filtra por departamento.
 * @param {boolean} [options.isActive]  - Filtra ativos (true) ou inativos (false).
 * @returns {Promise<{rows: object[], total: number}>}
 */
export async function listUsers({ page = 1, limit = 10, search = '', department, isActive } = {}) {
    const pool = await poolPromise;
    const offset = (page - 1) * limit;

    const request = pool.request()
        .input('limit', sql.Int, limit)
        .input('offset', sql.Int, offset);

    const conditions = [];

    if (search) {
        request.input('search', sql.NVarChar(210), `%${search}%`);
        conditions.push('([name] LIKE @search OR email LIKE @search)');
    }

    if (department !== undefined) {
        request.input('department', sql.TinyInt, department);
        conditions.push('department = @department');
    }

    if (isActive !== undefined) {
        request.input('is_active', sql.Bit, isActive);
        conditions.push('ISNULL(is_active, 0) = @is_active');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await request.query(`
        SELECT ${USER_FIELDS}, COUNT(*) OVER() AS total_count
        FROM users
        ${whereClause}
        ORDER BY [name] ASC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    const rows = result.recordset;
    return {
        rows: rows.map(({ total_count, ...row }) => row),
        total: rows.length > 0 ? rows[0].total_count : 0,
    };
}

export async function getUserById(id) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, id)
        .query(`SELECT ${USER_FIELDS} FROM users WHERE id = @id`);
    return result.recordset[0] ?? null;
}

// Id do usuário com este e-mail, ativo ou não (e-mail é único na tabela)
export async function getUserIdByEmail(email) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('email', sql.NVarChar(200), email)
        .query('SELECT id FROM users WHERE email = @email');
    return result.recordset[0]?.id ?? null;
}

/**
 * Insere um usuário ativo. Sem `role`, vale o default da coluna ('SOLICITANTE').
 * Retorna o id gerado.
 */
export async function insertUser({ name, email, department, role, passwordHash }) {
    const pool = await poolPromise;
    const request = pool.request()
        .input('name', sql.NVarChar(200), name)
        .input('email', sql.NVarChar(200), email)
        .input('department', sql.TinyInt, department)
        .input('password_hash', sql.VarChar(255), passwordHash);

    const columns = ['[name]', 'email', 'department', 'password_hash', 'is_active'];
    const values = ['@name', '@email', '@department', '@password_hash', '1'];

    if (role) {
        request.input('role', sql.VarChar(50), role);
        columns.push('[role]');
        values.push('@role');
    }

    const result = await request.query(`
        INSERT INTO users (${columns.join(', ')})
        OUTPUT INSERTED.id
        VALUES (${values.join(', ')})
    `);
    return result.recordset[0].id;
}

export async function updateUser(id, { name, email, department }) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, id)
        .input('name', sql.NVarChar(200), name)
        .input('email', sql.NVarChar(200), email)
        .input('department', sql.TinyInt, department)
        .query(`
            UPDATE users
            SET [name] = @name, email = @email, department = @department
            WHERE id = @id
        `);
    return result.rowsAffected[0] > 0;
}

export async function setUserActive(id, isActive) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, id)
        .input('is_active', sql.Bit, isActive)
        .query('UPDATE users SET is_active = @is_active WHERE id = @id');
    return result.rowsAffected[0] > 0;
}

export async function updateUserPassword(id, passwordHash) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, id)
        .input('password_hash', sql.VarChar(255), passwordHash)
        .query('UPDATE users SET password_hash = @password_hash WHERE id = @id');
    return result.rowsAffected[0] > 0;
}
