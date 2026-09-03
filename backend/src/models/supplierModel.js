// importando a configuração do banco de dados
import { sql, poolPromise } from '../config/dbConfig.js';

// ─────────────────────────────────────────────
// Leitura
// ─────────────────────────────────────────────

/**
 * Busca credenciais de login pelo CNPJ (apenas fornecedores ativos).
 */
export async function getSupplierByCnpj(cnpj) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('cnpj', sql.VarChar(18), cnpj)
        .query(`
            SELECT id, uid, cnpj, razao_social, nome_fantasia,
                   password_hash, mfa_enabled, status
            FROM suppliers
            WHERE cnpj = @cnpj AND status != 2  -- exclui inativos
        `);
    return result.recordset[0] ?? null;
}

/**
 * Busca os emails de contato (legal + operacional) de um fornecedor.
 * Retorna no máximo 2 registros.
 */
export async function getSupplierContactEmails(supplierId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('supplier_id', sql.Int, supplierId)
        .query(`
            SELECT email, contact_type
            FROM supplier_contacts
            WHERE supplier_id = @supplier_id
              AND contact_type IN (0, 1)  -- 0=Legal, 1=Operacional
            ORDER BY contact_type ASC
        `);
    return result.recordset;
}

/**
 * Busca um fornecedor completo por ID (para o payload do JWT e /me).
 */
export async function getSupplierById(supplierId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, supplierId)
        .query(`
            SELECT id, uid, cnpj, razao_social, nome_fantasia,
                   employee_count, city, [state], registration_complete,
                   overall_score, status
            FROM suppliers
            WHERE id = @id
        `);
    return result.recordset[0] ?? null;
}

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

// ─────────────────────────────────────────────
// Escrita
// ─────────────────────────────────────────────

/**
 * Insere um novo fornecedor. Retorna o ID gerado.
 */
export async function insertSupplier(transaction, {
    cnpj, razaoSocial, nomeFantasia, employeeCount,
    city, state, passwordHash
}) {
    const request = new sql.Request(transaction);
    const result = await request
        .input('cnpj', sql.VarChar(18), cnpj)
        .input('razao_social', sql.NVarChar(300), razaoSocial)
        .input('nome_fantasia', sql.NVarChar(300), nomeFantasia ?? null)
        .input('employee_count', sql.Int, employeeCount ?? null)
        .input('city', sql.NVarChar(150), city ?? null)
        .input('state', sql.VarChar(2), state ?? null)
        .input('password_hash', sql.VarChar(500), passwordHash)
        .query(`
            INSERT INTO suppliers
                (cnpj, razao_social, nome_fantasia, employee_count,
                 city, [state], password_hash,
                 cnpj_validated, registration_complete, status)
            OUTPUT INSERTED.id
            VALUES
                (@cnpj, @razao_social, @nome_fantasia, @employee_count,
                 @city, @state, @password_hash,
                 1, 0, 1)
        `);
    return result.recordset[0]?.id ?? null;
}

/**
 * Insere um contato de fornecedor.
 * contact_type: 0=Legal, 1=Operacional, 2=Financeiro
 */
export async function insertSupplierContact(transaction, {
    supplierId, name, email, phone, contactType, isPrimary
}) {
    const request = new sql.Request(transaction);
    await request
        .input('supplier_id', sql.Int, supplierId)
        .input('name', sql.NVarChar(200), name ?? '')
        .input('email', sql.NVarChar(200), email)
        .input('phone', sql.VarChar(20), phone ?? null)
        .input('contact_type', sql.TinyInt, contactType)
        .input('is_primary', sql.Bit, isPrimary ? 1 : 0)
        .query(`
            INSERT INTO supplier_contacts
                (supplier_id, [name], email, phone, contact_type, is_primary)
            VALUES
                (@supplier_id, @name, @email, @phone, @contact_type, @is_primary)
        `);
}

/**
 * Insere a relação fornecedor ↔ categoria de serviço.
 */
export async function insertSupplierCategory(transaction, supplierId, categoryId) {
    const request = new sql.Request(transaction);
    await request
        .input('supplier_id', sql.Int, supplierId)
        .input('category_id', sql.Int, categoryId)
        .query(`
            IF NOT EXISTS (
                SELECT 1 FROM supplier_categories
                WHERE supplier_id = @supplier_id AND category_id = @category_id
            )
            INSERT INTO supplier_categories (supplier_id, category_id)
            VALUES (@supplier_id, @category_id)
        `);
}

/**
 * Insere a relação fornecedor ↔ região atendida.
 */
export async function insertSupplierRegion(transaction, supplierId, regionId) {
    const request = new sql.Request(transaction);
    await request
        .input('supplier_id', sql.Int, supplierId)
        .input('region_id', sql.Int, regionId)
        .query(`
            IF NOT EXISTS (
                SELECT 1 FROM supplier_regions
                WHERE supplier_id = @supplier_id AND region_id = @region_id
            )
            INSERT INTO supplier_regions (supplier_id, region_id)
            VALUES (@supplier_id, @region_id)
        `);
}
