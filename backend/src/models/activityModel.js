// importando a configuração do banco de dados
import { sql, poolPromise } from '../config/dbConfig.js';

// Campos da atividade devolvidos pela API de Parâmetros. As colunas legado
// (nr_type_id, document_type_id e is_mandatory) não são mais lidas nem gravadas.
const ACTIVITY_FIELDS = `
    a.id,
    a.[name],
    a.[description],
    a.risk_level,
    CAST(ISNULL(a.is_active, 0) AS BIT) AS is_active
`;

// Documentos sugeridos de uma atividade, como a API devolve. Os inativos vêm com
// is_active = 0 (a tela mostra e o Admin decide se tira); os que viraram básicos ficam
// de fora, porque o básico já é exigido de todo colaborador.
const SUGGESTED_DOCUMENTS_QUERY = `
    SELECT
        atd.activity_type_id,
        dt.id,
        dt.[name],
        dt.category,
        nr.code,
        CAST(ISNULL(dt.is_active, 0) AS BIT) AS is_active
    FROM activity_type_documents AS atd
    INNER JOIN activity_types AS a  ON a.id  = atd.activity_type_id
    INNER JOIN document_types AS dt ON dt.id = atd.document_type_id
    LEFT  JOIN nr_types       AS nr ON nr.id = dt.nr_type_id
`;
const SUGGESTED_DOCUMENTS_FILTER = 'dt.category <> 1';
const SUGGESTED_DOCUMENTS_ORDER = 'ORDER BY dt.category ASC, nr.code ASC, dt.[name] ASC';

// Junta as atividades com os documentos sugeridos (linhas com activity_type_id)
function attachDocuments(activities, documentRows) {
    const byActivity = new Map();
    for (const { activity_type_id: activityId, ...document } of documentRows) {
        if (!byActivity.has(activityId)) byActivity.set(activityId, []);
        byActivity.get(activityId).push(document);
    }
    return activities.map((activity) => ({ ...activity, documents: byActivity.get(activity.id) ?? [] }));
}

/**
 * Lista as atividades (ativas e inativas), ordenadas por nome, com os documentos sugeridos.
 *
 * @param {object} options
 * @param {boolean} [options.isActive] - Filtra ativas (true) ou inativas (false).
 * @param {string}  [options.search]   - Busca no nome.
 * @returns {Promise<object[]>}
 */
export async function listActivities({ isActive, search = '' } = {}) {
    const pool = await poolPromise;
    const request = pool.request();
    const conditions = [];

    if (isActive !== undefined) {
        request.input('is_active', sql.Bit, isActive);
        conditions.push('ISNULL(a.is_active, 0) = @is_active');
    }

    if (search) {
        request.input('search', sql.NVarChar(210), `%${search}%`);
        conditions.push('a.[name] LIKE @search');
    }

    const activityWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const documentWhere = `WHERE ${[...conditions, SUGGESTED_DOCUMENTS_FILTER].join(' AND ')}`;

    // Duas consultas no mesmo lote (mesmos parâmetros): atividades e documentos sugeridos
    const result = await request.query(`
        SELECT ${ACTIVITY_FIELDS}
        FROM activity_types AS a
        ${activityWhere}
        ORDER BY a.[name] ASC;

        ${SUGGESTED_DOCUMENTS_QUERY}
        ${documentWhere}
        ${SUGGESTED_DOCUMENTS_ORDER};
    `);

    const [activities, documentRows] = result.recordsets;
    return attachDocuments(activities, documentRows);
}

/** Atividade pelo id, com os documentos sugeridos (mesmo formato da lista). */
export async function getActivityById(id) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, id)
        .query(`
            SELECT ${ACTIVITY_FIELDS}
            FROM activity_types AS a
            WHERE a.id = @id;

            ${SUGGESTED_DOCUMENTS_QUERY}
            WHERE a.id = @id AND ${SUGGESTED_DOCUMENTS_FILTER}
            ${SUGGESTED_DOCUMENTS_ORDER};
        `);

    const [activities, documentRows] = result.recordsets;
    if (activities.length === 0) return null;
    return attachDocuments(activities, documentRows)[0];
}

/**
 * Ids de TODOS os tipos de documento ligados à atividade (inclusive inativos), em
 * ordem crescente. É o estado real gravado, usado na comparação e na auditoria.
 */
export async function getActivityDocumentTypeIds(id) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, id)
        .query(`
            SELECT document_type_id
            FROM activity_type_documents
            WHERE activity_type_id = @id
            ORDER BY document_type_id ASC
        `);
    return result.recordset.map((row) => row.document_type_id);
}

/** Já existe outra atividade com este nome? (o nome é único na tabela) */
export async function activityNameInUse(name, excludeId = null) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('name', sql.NVarChar(200), name)
        .input('exclude_id', sql.Int, excludeId)
        .query(`
            SELECT TOP (1) id
            FROM activity_types
            WHERE [name] = @name
              AND (@exclude_id IS NULL OR id <> @exclude_id)
        `);
    return result.recordset.length > 0;
}

// As escritas abaixo recebem a transação: a auditoria é gravada junto (auditModel.insertAuditLog)

/**
 * Insere uma atividade ativa. As colunas legado ficam NULL (is_mandatory tem default 1,
 * por isso vai NULL explícito). Retorna o id gerado.
 */
export async function insertActivity(transaction, { name, description, riskLevel }) {
    const result = await new sql.Request(transaction)
        .input('name', sql.NVarChar(200), name)
        .input('description', sql.NVarChar(sql.MAX), description ?? null)
        .input('risk_level', sql.TinyInt, riskLevel ?? null)
        .query(`
            INSERT INTO activity_types
                ([name], [description], risk_level, is_active, nr_type_id, document_type_id, is_mandatory)
            OUTPUT INSERTED.id
            VALUES
                (@name, @description, @risk_level, 1, NULL, NULL, NULL)
        `);
    return result.recordset[0].id;
}

export async function updateActivity(transaction, id, { name, description, riskLevel }) {
    const result = await new sql.Request(transaction)
        .input('id', sql.Int, id)
        .input('name', sql.NVarChar(200), name)
        .input('description', sql.NVarChar(sql.MAX), description ?? null)
        .input('risk_level', sql.TinyInt, riskLevel ?? null)
        .query(`
            UPDATE activity_types
            SET [name] = @name, [description] = @description, risk_level = @risk_level
            WHERE id = @id
        `);
    return result.rowsAffected[0] > 0;
}

export async function setActivityActive(transaction, id, isActive) {
    const result = await new sql.Request(transaction)
        .input('id', sql.Int, id)
        .input('is_active', sql.Bit, isActive)
        .query('UPDATE activity_types SET is_active = @is_active WHERE id = @id');
    return result.rowsAffected[0] > 0;
}

/** Substitui os documentos sugeridos da atividade pelos ids informados (sem repetição). */
export async function replaceActivityDocuments(transaction, activityId, documentTypeIds) {
    const request = new sql.Request(transaction)
        .input('activity_type_id', sql.Int, activityId);

    let insert = '';
    if (documentTypeIds.length > 0) {
        const rows = documentTypeIds.map((documentTypeId, index) => {
            request.input(`document_type_id${index}`, sql.Int, documentTypeId);
            return `(@activity_type_id, @document_type_id${index})`;
        });
        insert = `
            INSERT INTO activity_type_documents (activity_type_id, document_type_id)
            VALUES ${rows.join(', ')};
        `;
    }

    await request.query(`
        DELETE FROM activity_type_documents WHERE activity_type_id = @activity_type_id;
        ${insert}
    `);
}
