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
 * Busca credenciais de login pelo e-mail OPERACIONAL (contact_type = 1).
 * Usado no login por e-mail operacional (alternativa ao CNPJ).
 */
export async function getSupplierByOperationalEmail(email) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('email', sql.NVarChar(200), email)
        .query(`
            SELECT s.id, s.uid, s.cnpj, s.razao_social, s.nome_fantasia,
                   s.password_hash, s.mfa_enabled, s.status
            FROM suppliers AS s
            INNER JOIN supplier_contacts AS sc ON sc.supplier_id = s.id
            WHERE LOWER(sc.email) = LOWER(@email)
              AND sc.contact_type = 1   -- Operacional
              AND s.status != 2         -- exclui inativos
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
 * Retorna { id, employee_count } para uma lista de fornecedores.
 * Usado na comparação de cotações.
 */
export async function getEmployeeCountsByIds(ids = []) {
    if (!ids || ids.length === 0) return [];
    const pool = await poolPromise;
    const request = pool.request();
    const params = ids.map((id, i) => {
        request.input(`id${i}`, sql.Int, id);
        return `@id${i}`;
    });
    const result = await request.query(
        `SELECT id, employee_count FROM suppliers WHERE id IN (${params.join(',')})`,
    );
    return result.recordset;
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

/**
 * Perfil completo do fornecedor (dados da empresa) — para a tela de Perfil.
 */
export async function getSupplierProfile(supplierId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, supplierId)
        .query(`
            SELECT id, uid, cnpj, razao_social, nome_fantasia,
                   employee_count, address, city, [state], zip_code,
                   phone, website, registration_complete, overall_score, status
            FROM suppliers
            WHERE id = @id
        `);
    return result.recordset[0] ?? null;
}

/**
 * Lista os contatos completos de um fornecedor (todos os tipos).
 */
export async function getSupplierContacts(supplierId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('supplier_id', sql.Int, supplierId)
        .query(`
            SELECT id, name, email, phone, contact_type, is_primary
            FROM supplier_contacts
            WHERE supplier_id = @supplier_id
            ORDER BY contact_type ASC
        `);
    return result.recordset;
}

/**
 * Lista as regiões atendidas por um fornecedor (com cidade/estado).
 */
export async function getSupplierRegions(supplierId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('supplier_id', sql.Int, supplierId)
        .query(`
            SELECT r.id, r.city, r.[state], r.country
            FROM supplier_regions AS sr
            INNER JOIN regions AS r ON r.id = sr.region_id
            WHERE sr.supplier_id = @supplier_id
            ORDER BY r.[state] ASC, r.city ASC
        `);
    return result.recordset;
}

/**
 * Lista fornecedores para o painel interno (Suprimentos), com busca e filtro.
 */
export async function listSuppliers({ search = '', status } = {}) {
    const pool = await poolPromise;
    const request = pool.request();
    const conditions = [];

    if (search) {
        request.input('search', sql.NVarChar(300), `%${search}%`);
        conditions.push('(s.razao_social LIKE @search OR s.nome_fantasia LIKE @search OR s.cnpj LIKE @search)');
    }
    if (status !== undefined && status !== null) {
        request.input('status', sql.TinyInt, status);
        conditions.push('s.[status] = @status');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await request.query(`
        SELECT id, uid, cnpj, razao_social, nome_fantasia,
               employee_count, city, [state], overall_score, status, created_at
        FROM suppliers AS s
        ${where}
        ORDER BY s.razao_social ASC
    `);
    return result.recordset;
}

/**
 * Categorias/atividades de serviço de um fornecedor (nomes resolvidos).
 */
export async function getSupplierCategories(supplierId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('supplier_id', sql.Int, supplierId)
        .query(`
            SELECT a.id, a.[name]
            FROM supplier_categories AS sc
            INNER JOIN activity_types AS a ON a.id = sc.category_id
            WHERE sc.supplier_id = @supplier_id
            ORDER BY a.[name] ASC
        `);
    return result.recordset;
}

// ─────────────────────────────────────────────
// Escrita
// ─────────────────────────────────────────────

/**
 * Atualiza dados editáveis da empresa (perfil do fornecedor).
 */
export async function updateSupplierProfile(transaction, supplierId, {
    nomeFantasia, employeeCount, address, city, state, zipCode, phone, website
}) {
    const request = new sql.Request(transaction);
    await request
        .input('id', sql.Int, supplierId)
        .input('nome_fantasia', sql.NVarChar(300), nomeFantasia ?? null)
        .input('employee_count', sql.Int, employeeCount ?? null)
        .input('address', sql.NVarChar(sql.MAX), address ?? null)
        .input('city', sql.NVarChar(150), city ?? null)
        .input('state', sql.VarChar(2), state ?? null)
        .input('zip_code', sql.VarChar(10), zipCode ?? null)
        .input('phone', sql.VarChar(20), phone ?? null)
        .input('website', sql.NVarChar(300), website ?? null)
        .query(`
            UPDATE suppliers
            SET nome_fantasia  = @nome_fantasia,
                employee_count = @employee_count,
                address        = @address,
                city           = @city,
                [state]        = @state,
                zip_code       = @zip_code,
                phone          = @phone,
                website        = @website,
                updated_at     = GETDATE()
            WHERE id = @id
        `);
}

/**
 * Faz upsert de um contato por tipo (legal=0, operacional=1, financeiro=2).
 * Mantém no máximo um contato por tipo (o padrão do sistema).
 */
export async function upsertSupplierContactByType(transaction, supplierId, { name, email, phone, contactType, isPrimary }) {
    const request = new sql.Request(transaction);
    await request
        .input('supplier_id', sql.Int, supplierId)
        .input('name', sql.NVarChar(200), name ?? '')
        .input('email', sql.NVarChar(200), email)
        .input('phone', sql.VarChar(20), phone ?? null)
        .input('contact_type', sql.TinyInt, contactType)
        .input('is_primary', sql.Bit, isPrimary ? 1 : 0)
        .query(`
            IF EXISTS (SELECT 1 FROM supplier_contacts WHERE supplier_id = @supplier_id AND contact_type = @contact_type)
                UPDATE supplier_contacts
                SET [name] = @name, email = @email, phone = @phone, is_primary = @is_primary
                WHERE supplier_id = @supplier_id AND contact_type = @contact_type
            ELSE
                INSERT INTO supplier_contacts (supplier_id, [name], email, phone, contact_type, is_primary)
                VALUES (@supplier_id, @name, @email, @phone, @contact_type, @is_primary)
        `);
}

/**
 * Substitui todas as regiões atendidas por um novo conjunto.
 */
export async function replaceSupplierRegions(transaction, supplierId, regionIds = []) {
    const del = new sql.Request(transaction);
    await del
        .input('supplier_id', sql.Int, supplierId)
        .query('DELETE FROM supplier_regions WHERE supplier_id = @supplier_id');

    for (const regionId of regionIds) {
        const ins = new sql.Request(transaction);
        await ins
            .input('supplier_id', sql.Int, supplierId)
            .input('region_id', sql.Int, regionId)
            .query(`
                IF NOT EXISTS (
                    SELECT 1 FROM supplier_regions WHERE supplier_id = @supplier_id AND region_id = @region_id
                )
                INSERT INTO supplier_regions (supplier_id, region_id)
                VALUES (@supplier_id, @region_id)
            `);
    }
}

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
