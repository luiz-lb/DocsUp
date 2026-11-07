// importando a configuração do banco de dados
import { sql, poolPromise } from '../config/dbConfig.js';

// Os usuários do fornecedor (login, e-mails) ficam em supplierUserModel.js.

// ─────────────────────────────────────────────
// Leitura
// ─────────────────────────────────────────────

/**
 * Verifica se um CNPJ já está cadastrado.
 */
export async function supplierExistsByCnpj(cnpj) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('cnpj', sql.VarChar(18), cnpj)
        .query('SELECT 1 AS exists_flag FROM suppliers WHERE cnpj = @cnpj');
    return result.recordset.length > 0;
}

/**
 * Dados da empresa (perfil no portal e detalhe no painel interno).
 */
export async function getSupplierProfile(supplierId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, supplierId)
        .query(`
            SELECT id, uid, cnpj, razao_social, nome_fantasia, cnpj_status,
                   overall_score, status, created_at, updated_at
            FROM suppliers
            WHERE id = @id
        `);
    return result.recordset[0] ?? null;
}

/**
 * Lista fornecedores para o painel interno (Suprimentos), com busca e filtro.
 * Traz o e-mail do Responsável e do Operador (a busca também olha os e-mails).
 */
export async function listSuppliers({ search = '', status } = {}) {
    const pool = await poolPromise;
    const request = pool.request();
    const conditions = [];

    if (search) {
        request.input('search', sql.NVarChar(300), `%${search}%`);
        conditions.push(`(
            s.razao_social LIKE @search OR s.nome_fantasia LIKE @search OR s.cnpj LIKE @search
            OR EXISTS (SELECT 1 FROM supplier_users AS su WHERE su.supplier_id = s.id AND su.email LIKE @search)
        )`);
    }
    if (status !== undefined && status !== null) {
        request.input('status', sql.TinyInt, status);
        conditions.push('s.[status] = @status');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await request.query(`
        SELECT
            s.id, s.uid, s.cnpj, s.razao_social, s.nome_fantasia,
            s.overall_score, s.status, s.created_at,
            owner_user.[name]    AS owner_name,
            owner_user.email     AS owner_email,
            operator_user.[name] AS operator_name,
            operator_user.email  AS operator_email
        FROM suppliers AS s
        LEFT JOIN supplier_users AS owner_user
            ON owner_user.supplier_id = s.id AND owner_user.[role] = 0
        LEFT JOIN supplier_users AS operator_user
            ON operator_user.supplier_id = s.id AND operator_user.[role] = 1
        ${where}
        ORDER BY s.razao_social ASC
    `);
    return result.recordset;
}

// ─────────────────────────────────────────────
// Escrita
// ─────────────────────────────────────────────

/**
 * Nome fantasia (o único dado da empresa editável no portal; CNPJ e razão social ficam fixos).
 */
export async function updateCompany(transaction, supplierId, { nomeFantasia }) {
    const result = await new sql.Request(transaction)
        .input('id', sql.Int, supplierId)
        .input('nome_fantasia', sql.NVarChar(300), nomeFantasia ?? null)
        .query(`
            UPDATE suppliers
            SET nome_fantasia = @nome_fantasia,
                updated_at    = GETDATE()
            WHERE id = @id
        `);
    return result.rowsAffected[0] > 0;
}

/**
 * Insere um novo fornecedor (ativo, CNPJ conferido). A senha fica nos usuários
 * (supplier_users). Retorna o ID gerado.
 */
export async function insertSupplier(transaction, { cnpj, razaoSocial, nomeFantasia, cnpjStatus }) {
    const result = await new sql.Request(transaction)
        .input('cnpj', sql.VarChar(18), cnpj)
        .input('razao_social', sql.NVarChar(300), razaoSocial)
        .input('nome_fantasia', sql.NVarChar(300), nomeFantasia ?? null)
        .input('cnpj_status', sql.VarChar(50), cnpjStatus ?? null)
        .query(`
            INSERT INTO suppliers
                (cnpj, razao_social, nome_fantasia, cnpj_status,
                 cnpj_validated, registration_complete, status)
            OUTPUT INSERTED.id
            VALUES
                (@cnpj, @razao_social, @nome_fantasia, @cnpj_status,
                 1, 1, 1)
        `);
    return result.recordset[0]?.id ?? null;
}
