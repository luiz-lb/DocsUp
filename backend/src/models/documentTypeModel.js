// importando a configuração do banco de dados
import { sql, poolPromise } from '../config/dbConfig.js';

// Campos devolvidos pela API de Parâmetros. is_active nulo conta como inativo, igual às
// telas que só listam is_active = 1. code / nr_name só existem nas NRs (categoria 2).
const DOCUMENT_TYPE_FIELDS = `
    dt.id,
    dt.[name],
    dt.[description],
    dt.category,
    dt.has_expiration,
    dt.validity_days,
    dt.validation_method,
    CAST(ISNULL(dt.is_active, 0) AS BIT) AS is_active,
    dt.nr_type_id,
    nr.code,
    nr.[name] AS nr_name
`;

// Ordem padrão: categoria e depois nome; nas NRs (categoria 2), pelo código
const DOCUMENT_TYPE_ORDER = 'dt.category ASC, nr.code ASC, dt.[name] ASC';

/**
 * Lista os tipos de documento (ativos e inativos), sem paginação.
 *
 * @param {object} options
 * @param {number}  [options.category] - Filtra pela categoria (0 a 3).
 * @param {boolean} [options.isActive] - Filtra ativos (true) ou inativos (false).
 * @param {string}  [options.search]   - Busca no nome (e no código / título da NR).
 * @returns {Promise<object[]>}
 */
export async function listDocumentTypes({ category, isActive, search = '' } = {}) {
    const pool = await poolPromise;
    const request = pool.request();
    const conditions = [];

    if (category !== undefined) {
        request.input('category', sql.TinyInt, category);
        conditions.push('dt.category = @category');
    }

    if (isActive !== undefined) {
        request.input('is_active', sql.Bit, isActive);
        conditions.push('ISNULL(dt.is_active, 0) = @is_active');
    }

    if (search) {
        request.input('search', sql.NVarChar(210), `%${search}%`);
        conditions.push('(dt.[name] LIKE @search OR nr.code LIKE @search OR nr.[name] LIKE @search)');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await request.query(`
        SELECT ${DOCUMENT_TYPE_FIELDS}
        FROM document_types AS dt
        LEFT JOIN nr_types AS nr ON nr.id = dt.nr_type_id
        ${whereClause}
        ORDER BY ${DOCUMENT_TYPE_ORDER}
    `);

    return result.recordset;
}

export async function getDocumentTypeById(id) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, id)
        .query(`
            SELECT ${DOCUMENT_TYPE_FIELDS}
            FROM document_types AS dt
            LEFT JOIN nr_types AS nr ON nr.id = dt.nr_type_id
            WHERE dt.id = @id
        `);
    return result.recordset[0] ?? null;
}

/**
 * Busca vários tipos de documento pelos ids (para validar sugestões de atividade).
 * Retorna [{ id, category, is_active }]; ids inexistentes simplesmente não vêm.
 */
export async function getDocumentTypesByIds(ids) {
    if (!ids || ids.length === 0) return [];

    const pool = await poolPromise;
    const request = pool.request();
    const params = ids.map((id, index) => {
        request.input(`id${index}`, sql.Int, id);
        return `@id${index}`;
    });

    const result = await request.query(`
        SELECT id, category, CAST(ISNULL(is_active, 0) AS BIT) AS is_active
        FROM document_types
        WHERE id IN (${params.join(', ')})
    `);
    return result.recordset;
}

/**
 * Já existe outro tipo de documento com este nome? (a comparação segue a collation
 * do banco, que não diferencia maiúsculas de minúsculas)
 */
export async function documentTypeNameInUse(name, excludeId = null) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('name', sql.NVarChar(200), name)
        .input('exclude_id', sql.Int, excludeId)
        .query(`
            SELECT TOP (1) id
            FROM document_types
            WHERE [name] = @name
              AND (@exclude_id IS NULL OR id <> @exclude_id)
        `);
    return result.recordset.length > 0;
}

/**
 * NR pelo código (ex.: 'NR-35'), com o tipo de documento ligado a ela, se houver.
 * Retorna { id, code, name, document_type_id } ou null.
 */
export async function getNrTypeByCode(code) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('code', sql.VarChar(10), code)
        .query(`
            SELECT TOP (1) nr.id, nr.code, nr.[name], dt.id AS document_type_id
            FROM nr_types AS nr
            LEFT JOIN document_types AS dt ON dt.nr_type_id = nr.id
            WHERE nr.code = @code
        `);
    return result.recordset[0] ?? null;
}

// As escritas abaixo recebem a transação: a auditoria é gravada junto (auditModel.insertAuditLog)

/** Insere uma NR em nr_types. Retorna o id gerado. */
export async function insertNrType(transaction, { code, name, description }) {
    const result = await new sql.Request(transaction)
        .input('code', sql.VarChar(10), code)
        .input('name', sql.NVarChar(200), name)
        .input('description', sql.NVarChar(sql.MAX), description ?? null)
        .query(`
            INSERT INTO nr_types (code, [name], [description])
            OUTPUT INSERTED.id
            VALUES (@code, @name, @description)
        `);
    return result.recordset[0].id;
}

/** Atualiza código, título e descrição de uma NR (mantém nr_types em sincronia com o tipo). */
export async function updateNrType(transaction, id, { code, name, description }) {
    const result = await new sql.Request(transaction)
        .input('id', sql.Int, id)
        .input('code', sql.VarChar(10), code)
        .input('name', sql.NVarChar(200), name)
        .input('description', sql.NVarChar(sql.MAX), description ?? null)
        .query(`
            UPDATE nr_types
            SET code = @code, [name] = @name, [description] = @description
            WHERE id = @id
        `);
    return result.rowsAffected[0] > 0;
}

/**
 * Insere um tipo de documento ativo. scope e validation_method vêm do service
 * (scope derivado da categoria; tipos novos usam validação manual).
 * Retorna o id gerado.
 */
export async function insertDocumentType(transaction, {
    name, description, category, scope, validationMethod, hasExpiration, validityDays, nrTypeId,
}) {
    const result = await new sql.Request(transaction)
        .input('name', sql.NVarChar(200), name)
        .input('description', sql.NVarChar(sql.MAX), description ?? null)
        .input('category', sql.TinyInt, category)
        .input('scope', sql.TinyInt, scope)
        .input('validation_method', sql.TinyInt, validationMethod)
        .input('has_expiration', sql.Bit, hasExpiration)
        .input('validity_days', sql.Int, validityDays ?? null)
        .input('nr_type_id', sql.Int, nrTypeId ?? null)
        .query(`
            INSERT INTO document_types
                ([name], [description], category, scope, validation_method,
                 has_expiration, validity_days, nr_type_id, is_active)
            OUTPUT INSERTED.id
            VALUES
                (@name, @description, @category, @scope, @validation_method,
                 @has_expiration, @validity_days, @nr_type_id, 1)
        `);
    return result.recordset[0].id;
}

/**
 * Atualiza os dados editáveis de um tipo de documento. Não mexe em validation_method,
 * api_endpoint, nr_type_id nem is_active.
 */
export async function updateDocumentType(transaction, id, {
    name, description, category, scope, hasExpiration, validityDays,
}) {
    const result = await new sql.Request(transaction)
        .input('id', sql.Int, id)
        .input('name', sql.NVarChar(200), name)
        .input('description', sql.NVarChar(sql.MAX), description ?? null)
        .input('category', sql.TinyInt, category)
        .input('scope', sql.TinyInt, scope)
        .input('has_expiration', sql.Bit, hasExpiration)
        .input('validity_days', sql.Int, validityDays ?? null)
        .query(`
            UPDATE document_types
            SET [name]         = @name,
                [description]  = @description,
                category       = @category,
                scope          = @scope,
                has_expiration = @has_expiration,
                validity_days  = @validity_days
            WHERE id = @id
        `);
    return result.rowsAffected[0] > 0;
}

export async function setDocumentTypeActive(transaction, id, isActive) {
    const result = await new sql.Request(transaction)
        .input('id', sql.Int, id)
        .input('is_active', sql.Bit, isActive)
        .query('UPDATE document_types SET is_active = @is_active WHERE id = @id');
    return result.rowsAffected[0] > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fase 2 (portal do fornecedor)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tipos ATIVOS de documento de colaborador (categorias 1, 2 e 3), com `required`:
 * básico (categoria 1) é exigido de todo colaborador; os demais, quando a NR está em
 * labor_request_NRs ou o tipo está em labor_request_documents da solicitação.
 */
export async function getEmployeeDocumentTypesForRequest(laborRequestId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('labor_request_id', sql.Int, laborRequestId)
        .query(`
            SELECT
                dt.id,
                dt.[name],
                dt.[description],
                dt.category,
                dt.has_expiration,
                dt.validity_days,
                nr.code,
                CAST(CASE
                    WHEN dt.category = 1 THEN 1
                    WHEN dt.nr_type_id IS NOT NULL AND EXISTS (
                        SELECT 1 FROM labor_request_NRs AS lrn
                        WHERE lrn.labor_request_id = @labor_request_id
                          AND lrn.nr_type_id = dt.nr_type_id
                    ) THEN 1
                    WHEN EXISTS (
                        SELECT 1 FROM labor_request_documents AS lrd
                        WHERE lrd.labor_request_id = @labor_request_id
                          AND lrd.document_type_id = dt.id
                    ) THEN 1
                    ELSE 0
                END AS BIT) AS [required]
            FROM document_types AS dt
            LEFT JOIN nr_types AS nr ON nr.id = dt.nr_type_id
            WHERE dt.is_active = 1
              AND dt.category IN (1, 2, 3)
            ORDER BY ${DOCUMENT_TYPE_ORDER}
        `);
    return result.recordset;
}

/**
 * Tipos de documento da EMPRESA exigidos na solicitação (labor_request_documents,
 * categoria 0, ativos).
 */
export async function getRequiredCompanyDocumentTypes(laborRequestId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('labor_request_id', sql.Int, laborRequestId)
        .query(`
            SELECT
                dt.id,
                dt.[name],
                dt.[description],
                dt.has_expiration,
                dt.validity_days
            FROM labor_request_documents AS lrd
            INNER JOIN document_types AS dt ON dt.id = lrd.document_type_id
            WHERE lrd.labor_request_id = @labor_request_id
              AND dt.category = 0
              AND dt.is_active = 1
            ORDER BY dt.[name] ASC
        `);
    return result.recordset;
}
