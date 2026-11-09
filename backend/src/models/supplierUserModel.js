// Usuários do fornecedor (supplier_users): Responsável (role 0) e Operador (role 1)
import { sql, poolPromise } from '../config/dbConfig.js';

// Campos do usuário com os dados do fornecedor (login, sessão e perfil)
const USER_WITH_SUPPLIER = `
    su.id,
    su.supplier_id,
    su.[role],
    su.[name],
    su.email,
    su.is_active,
    su.sessions_valid_after,
    su.email_verified_at,
    s.cnpj,
    s.razao_social,
    s.nome_fantasia,
    s.[status] AS supplier_status
`;

// ─────────────────────────────────────────────
// Leitura
// ─────────────────────────────────────────────

/** Usuário pelo e-mail (login), com o hash da senha e o status do fornecedor. */
export async function getUserForLogin(email) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('email', sql.NVarChar(200), email)
        .query(`
            SELECT ${USER_WITH_SUPPLIER}, su.password_hash
            FROM supplier_users AS su
            INNER JOIN suppliers AS s ON s.id = su.supplier_id
            WHERE su.email = @email
        `);
    return result.recordset[0] ?? null;
}

/** Usuário pelo id, com os dados do fornecedor (sessão do portal). */
export async function getUserById(id) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, id)
        .query(`
            SELECT ${USER_WITH_SUPPLIER}
            FROM supplier_users AS su
            INNER JOIN suppliers AS s ON s.id = su.supplier_id
            WHERE su.id = @id
        `);
    return result.recordset[0] ?? null;
}

/** Hash da senha de um usuário (troca de senha confere a senha atual). */
export async function getPasswordHash(id) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT password_hash FROM supplier_users WHERE id = @id');
    return result.recordset[0]?.password_hash ?? null;
}

/** Os usuários de um fornecedor (Responsável primeiro). */
export async function listUsersBySupplier(supplierId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('supplier_id', sql.Int, supplierId)
        .query(`
            SELECT id, [role], [name], email, is_active, created_at, updated_at
            FROM supplier_users
            WHERE supplier_id = @supplier_id
            ORDER BY [role] ASC
        `);
    return result.recordset;
}

/** E-mails dos usuários ativos de um fornecedor (avisos e código de acesso). */
export async function getActiveEmailsBySupplier(supplierId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('supplier_id', sql.Int, supplierId)
        .query(`
            SELECT email, [role]
            FROM supplier_users
            WHERE supplier_id = @supplier_id AND is_active = 1
            ORDER BY [role] ASC
        `);
    return result.recordset;
}

/**
 * Usuário ativo com este e-mail, com o fornecedor (indicar fornecedor por e-mail).
 * Fornecedor inativo (2) ou bloqueado (3) também volta: quem chama decide o que fazer.
 */
export async function findActiveUserByEmail(email) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('email', sql.NVarChar(200), email)
        .query(`
            SELECT ${USER_WITH_SUPPLIER}
            FROM supplier_users AS su
            INNER JOIN suppliers AS s ON s.id = su.supplier_id
            WHERE su.email = @email AND su.is_active = 1
        `);
    return result.recordset[0] ?? null;
}

/** Algum usuário (de qualquer fornecedor, menos `exceptUserId`) já usa este e-mail? */
export async function emailInUse(email, exceptUserId = null) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('email', sql.NVarChar(200), email)
        .input('except_id', sql.Int, exceptUserId)
        .query(`
            SELECT 1 AS in_use
            FROM supplier_users
            WHERE email = @email AND (@except_id IS NULL OR id <> @except_id)
        `);
    return result.recordset.length > 0;
}

// ─────────────────────────────────────────────
// Escrita
// ─────────────────────────────────────────────

export async function insertUser(transaction, { supplierId, role, name, email, passwordHash }) {
    const result = await new sql.Request(transaction)
        .input('supplier_id', sql.Int, supplierId)
        .input('role', sql.TinyInt, role)
        .input('name', sql.NVarChar(200), name)
        .input('email', sql.NVarChar(200), email)
        .input('password_hash', sql.VarChar(255), passwordHash)
        .query(`
            INSERT INTO supplier_users (supplier_id, [role], [name], email, password_hash)
            OUTPUT INSERTED.id
            VALUES (@supplier_id, @role, @name, @email, @password_hash)
        `);
    return result.recordset[0]?.id ?? null;
}

/** Nome e e-mail do usuário. E-mail trocado volta a ficar sem confirmação (até o próximo login). */
export async function updateUser(transaction, id, { name, email }) {
    const result = await new sql.Request(transaction)
        .input('id', sql.Int, id)
        .input('name', sql.NVarChar(200), name)
        .input('email', sql.NVarChar(200), email)
        .query(`
            UPDATE supplier_users
            SET [name] = @name,
                email_verified_at = CASE WHEN email = @email THEN email_verified_at ELSE NULL END,
                email = @email,
                updated_at = GETDATE()
            WHERE id = @id
        `);
    return result.rowsAffected[0] > 0;
}

/**
 * Marca o e-mail como confirmado (login com o código enviado para ele). Só confirma se o
 * e-mail do usuário ainda é o mesmo para onde o código foi enviado.
 */
export async function markEmailVerified(id, email) {
    const pool = await poolPromise;
    await pool.request()
        .input('id', sql.Int, id)
        .input('email', sql.NVarChar(200), email)
        .query(`
            UPDATE supplier_users
            SET email_verified_at = GETDATE()
            WHERE id = @id AND email = @email AND email_verified_at IS NULL
        `);
}

/**
 * Troca a senha e encerra as sessões abertas antes de `sessionsValidAfter`
 * (o JWT tem precisão de segundo: o instante já vem alinhado ao segundo).
 */
export async function updatePassword(transaction, id, passwordHash, sessionsValidAfter) {
    const result = await new sql.Request(transaction)
        .input('id', sql.Int, id)
        .input('password_hash', sql.VarChar(255), passwordHash)
        .input('sessions_valid_after', sql.DateTime2(0), sessionsValidAfter)
        .query(`
            UPDATE supplier_users
            SET password_hash = @password_hash,
                sessions_valid_after = @sessions_valid_after,
                updated_at = GETDATE()
            WHERE id = @id
        `);
    return result.rowsAffected[0] > 0;
}
