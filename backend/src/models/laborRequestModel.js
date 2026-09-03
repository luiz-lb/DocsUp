// importando a configuração do banco de dados
import {sql, poolPromise} from '../config/dbConfig.js';

export async function laborRequestNew(transaction, id_user, activity_type_id, title, description, location, urgency, startDate) {
    const request = new sql.Request(transaction);
    const result = await request
        .input('id_user', sql.Int, id_user)
        .input('activity_type_id', sql.Int, activity_type_id)
        .input('title', sql.VarChar, title)
        .input('description', sql.VarChar, description)
        .input('location', sql.VarChar, location)
        .input('urgency', sql.TinyInt, urgency)
        .input('startDate', sql.DateTime2, startDate)
        .query('insert into labor_requests (requester_id, activity_type_id, title, [description], [location], start_date, urgency, [status], update_by_id) Output inserted.id VALUES (@id_user,@activity_type_id, @title, @description, @location, @startDate, @urgency, 0, @id_user)');

    return result.recordset[0];
}

/**
 * Lista solicitações com paginação, busca e filtros.
 *
 * @param {object} options
 * @param {number} options.page     - Página (1-based).
 * @param {number} options.limit    - Itens por página.
 * @param {string} options.search   - Busca livre (titulo, local, solicitante, atividade).
 * @param {number} [options.status]  - Filtra por status (LABOR_REQUEST_STATUS).
 * @param {number} [options.urgency] - Filtra por urgencia (URGENCY).
 * @returns {Promise<{rows: object[], total: number}>}
 */
export async function getLaborRequest({ page = 1, limit = 10, search = '', status, urgency } = {}) {
    const pool = await poolPromise;
    const offset = (page - 1) * limit;

    const request = pool.request()
        .input('limit', sql.Int, limit)
        .input('offset', sql.Int, offset);

    const conditions = [];

    if (search) {
        request.input('search', sql.VarChar, `%${search}%`);
        conditions.push('(r.title LIKE @search OR r.[location] LIKE @search OR u.[name] LIKE @search OR a.[name] LIKE @search)');
    }

    if (status !== undefined && status !== null) {
        request.input('status', sql.TinyInt, status);
        conditions.push('r.[status] = @status');
    }

    if (urgency !== undefined && urgency !== null) {
        request.input('urgency', sql.TinyInt, urgency);
        conditions.push('r.urgency = @urgency');
    }

    const whereClause = conditions.length > 0 ? `Where ${conditions.join(' And ')}` : '';

    const result = await request.query(`
        Select
            r.id,
            u.[name] as requester_name,
            r.activity_type_id,
            a.[name] as activity_name,
            r.[location],
            r.title,
            r.urgency,
            r.[status],
            r.created_at,
            Count(*) Over() as total_count
        from labor_requests as r
        Inner join users as u on u.id = r.requester_id
        Inner join activity_types as a on a.id = r.activity_type_id
        ${whereClause}
        Order by r.created_at Desc
        Offset @offset Rows Fetch Next @limit Rows Only
    `);

    const rows = result.recordset;
    const total = rows.length > 0 ? rows[0].total_count : 0;

    return {
        rows: rows.map(({ total_count, ...row }) => row),
        total,
    };
}

export async function getLaborRequestById(id) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, id)
        .query(`
            Select
                r.id,
                r.uid,
                r.request_number,
                r.requester_id,
                u.[name] as requester_name,
                r.activity_type_id,
                at.[name] as activity_type_name,
                at.document_type_id as activity_doc_type_id,
                at.nr_type_id as activity_nr_type_id,
                r.title,
                r.[description],
                r.[location],
                r.start_date,
                r.end_date,
                r.urgency,
                r.[status],
                r.created_at,
                r.updated_at
            from labor_requests as r
            Inner join users as u on u.id = r.requester_id
            Left join activity_types as at on at.id = r.activity_type_id
            Where r.id = @id
        `);

    return result.recordset[0];
}

export async function createLaborRequestAprovals(transaction, labor_request_id, departamentNumber) {
    const request = new sql.Request(transaction);
    const result = await request
        .input('labor_request_id', sql.Int, labor_request_id)
        .input('department', sql.Int, departamentNumber)
        .query('Insert Into labor_request_approvals (labor_request_id,department, created_at) Values (@labor_request_id, @department, GetDate())');

    return result.rowsAffected > 0;
}

/**
 * Busca as aprovações de uma solicitação pelo ID.
 * Retorna decision, comments, decidedAt e o nome do aprovador (se houver).
 */
export async function getApprovalsByLaborRequestId(laborRequestId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('labor_request_id', sql.Int, laborRequestId)
        .query(`
            SELECT
                a.id,
                a.uid,
                a.labor_request_id,
                a.approver_id,
                u.[name] AS approver_name,
                a.department,
                a.decision,
                a.comments,
                a.decided_at,
                a.created_at
            FROM labor_request_approvals AS a
            LEFT JOIN users AS u ON u.id = a.approver_id
            WHERE a.labor_request_id = @labor_request_id
            ORDER BY a.department ASC
        `);

    return result.recordset;
}

/**
 * Registra a decisão de aprovação de um departamento.
 * department: TINYINT (0=RH, 1=Segurança do Trabalho, …)
 * decision: TINYINT (0=Pendente, 1=Reprovado, 2=Aprovado)
 */
export async function setApprovalDecision(transaction, laborRequestId, approverId, department, decision, comments) {
    const request = new sql.Request(transaction);
    const result = await request
        .input('labor_request_id', sql.Int, laborRequestId)
        .input('approver_id', sql.Int, approverId)
        .input('department', sql.TinyInt, department)
        .input('decision', sql.TinyInt, decision)
        .input('comments', sql.NVarChar(sql.MAX), comments ?? null)
        .query(`
            UPDATE labor_request_approvals
            SET
                approver_id  = @approver_id,
                decision     = @decision,
                comments     = @comments,
                decided_at   = GETDATE()
            WHERE labor_request_id = @labor_request_id
              AND department       = @department
        `);

    return result.rowsAffected[0] > 0;
}

/**
 * Atualiza o status da labor_request na tabela principal.
 * status: TINYINT conforme enums.js LABOR_REQUEST_STATUS
 */
export async function updateLaborRequestStatus(transaction, laborRequestId, status, updaterId) {
    const request = new sql.Request(transaction);
    const result = await request
        .input('id', sql.Int, laborRequestId)
        .input('status', sql.TinyInt, status)
        .input('updater_id', sql.Int, updaterId)
        .query(`
            UPDATE labor_requests
            SET status       = @status,
                updated_at   = GETDATE(),
                update_by_id = @updater_id
            WHERE id = @id
        `);

    return result.rowsAffected[0] > 0;
}

/**
 * Insere um documento obrigatório para a solicitação (tabela labor_request_documents).
 * Usa INSERT OR IGNORE (via merge) para evitar duplicatas.
 */
export async function insertLaborRequestDocument(transaction, laborRequestId, documentTypeId, addedById, notes) {
    const request = new sql.Request(transaction);
    await request
        .input('labor_request_id', sql.Int, laborRequestId)
        .input('document_type_id', sql.Int, documentTypeId)
        .input('added_by', sql.Int, addedById)
        .input('notes', sql.NVarChar(sql.MAX), notes ?? null)
        .query(`
            IF NOT EXISTS (
                SELECT 1 FROM labor_request_documents
                WHERE labor_request_id = @labor_request_id
                  AND document_type_id  = @document_type_id
            )
            INSERT INTO labor_request_documents (labor_request_id, document_type_id, added_by, notes)
            VALUES (@labor_request_id, @document_type_id, @added_by, @notes)
        `);
}

/**
 * Remove todos os documentos exigidos de uma solicitação e reinsere os novos.
 * Útil para quando Segurança do Trabalho edita a lista.
 */
export async function deleteLaborRequestDocuments(transaction, laborRequestId) {
    const request = new sql.Request(transaction);
    await request
        .input('labor_request_id', sql.Int, laborRequestId)
        .query('DELETE FROM labor_request_documents WHERE labor_request_id = @labor_request_id');
}

/**
 * Busca os documentos exigidos de uma solicitação com nome do tipo de documento.
 */
export async function getLaborRequestDocuments(laborRequestId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('labor_request_id', sql.Int, laborRequestId)
        .query(`
            SELECT
                lrd.id,
                lrd.labor_request_id,
                lrd.document_type_id,
                dt.[name]  AS document_type_name,
                dt.scope,
                dt.description,
                lrd.notes,
                lrd.added_by,
                u.[name]   AS added_by_name
            FROM labor_request_documents AS lrd
            INNER JOIN document_types AS dt ON dt.id = lrd.document_type_id
            LEFT  JOIN users          AS u  ON u.id  = lrd.added_by
            WHERE lrd.labor_request_id = @labor_request_id
            ORDER BY dt.[name] ASC
        `);

    return result.recordset;
}

// ─────────────────────────────────────────────────────────────────────────────
// NRs obrigatórias por solicitação (tabela labor_request_NRs)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Insere uma NR obrigatória para a solicitação.
 * Usa IF NOT EXISTS para evitar duplicatas.
 */
export async function insertLaborRequestNr(transaction, laborRequestId, nrTypeId, addedById) {
    const request = new sql.Request(transaction);
    await request
        .input('labor_request_id', sql.Int, laborRequestId)
        .input('nr_type_id', sql.Int, nrTypeId)
        .input('added_by', sql.Int, addedById)
        .query(`
            IF NOT EXISTS (
                SELECT 1 FROM labor_request_NRs
                WHERE labor_request_id = @labor_request_id
                  AND nr_type_id       = @nr_type_id
            )
            INSERT INTO labor_request_NRs (labor_request_id, nr_type_id, added_by)
            VALUES (@labor_request_id, @nr_type_id, @added_by)
        `);
}

/**
 * Remove todas as NRs obrigatórias de uma solicitação.
 * Útil para reedição pela Segurança do Trabalho.
 */
export async function deleteLaborRequestNrs(transaction, laborRequestId) {
    const request = new sql.Request(transaction);
    await request
        .input('labor_request_id', sql.Int, laborRequestId)
        .query('DELETE FROM labor_request_NRs WHERE labor_request_id = @labor_request_id');
}

/**
 * Busca as NRs obrigatórias de uma solicitação com nome e código.
 */
export async function getLaborRequestNrs(laborRequestId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('labor_request_id', sql.Int, laborRequestId)
        .query(`
            SELECT
                lrn.id,
                lrn.labor_request_id,
                lrn.nr_type_id,
                nt.code        AS nr_code,
                nt.[name]      AS nr_name,
                nt.[description],
                lrn.added_by,
                u.[name]       AS added_by_name,
                lrn.created_at
            FROM labor_request_NRs AS lrn
            INNER JOIN nr_types AS nt ON nt.id = lrn.nr_type_id
            LEFT  JOIN users    AS u  ON u.id  = lrn.added_by
            WHERE lrn.labor_request_id = @labor_request_id
            ORDER BY nt.code ASC
        `);

    return result.recordset;
}

/**
 * Busca a query getLaborRequestById com o campo nr_type_id da activity_types
 * para pré-selecionar as NRs sugeridas no painel de aprovação.
 * (Já incluído na query principal via getLaborRequestById — aqui apenas documentado.)
 */
