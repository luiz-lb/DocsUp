// Vínculo solicitação ↔ fornecedor (labor_request_suppliers) e a declaração do fornecedor
// (labor_request_supplier_declarations). Status em constants/laborRequest.js.
import { sql, poolPromise } from '../config/dbConfig.js';

// Vínculo com o fornecedor (quando já vinculado), a solicitação e quem criou / encerrou
const ASSIGNMENT_FIELDS = `
    l.id,
    l.uid,
    l.labor_request_id,
    l.supplier_id,
    l.invite_email,
    l.invite_token,
    l.deadline_at,
    l.[status],
    l.created_by,
    creator.[name]       AS created_by_name,
    creator.email        AS created_by_email,
    l.created_at,
    l.linked_at,
    l.declared_at,
    l.declared_by,
    declarer.[name]      AS declared_by_name,
    l.acceptance_ip,
    l.acceptance_user_agent,
    l.declaration_code,
    l.term_version,
    l.term_text,
    declarer.email       AS declared_by_email,
    declarer.[role]      AS declared_by_role,
    l.blocked_at,
    l.ended_at,
    l.ended_by,
    ender.[name]         AS ended_by_name,
    l.end_reason,
    l.end_comment,
    s.razao_social       AS supplier_name,
    s.cnpj               AS supplier_cnpj,
    lr.title             AS labor_request_title,
    lr.contract_number,
    lr.[location]        AS labor_request_location,
    lr.start_date        AS labor_request_start_date,
    lr.[status]          AS labor_request_status,
    lr.concluded_at      AS labor_request_concluded_at
`;

const ASSIGNMENT_JOINS = `
    INNER JOIN labor_requests AS lr ON lr.id = l.labor_request_id
    LEFT  JOIN suppliers      AS s  ON s.id  = l.supplier_id
    LEFT  JOIN users          AS creator  ON creator.id  = l.created_by
    LEFT  JOIN users          AS ender    ON ender.id    = l.ended_by
    LEFT  JOIN supplier_users AS declarer ON declarer.id = l.declared_by
`;

// ─────────────────────────────────────────────
// Leitura
// ─────────────────────────────────────────────

/** Vínculo aberto (aguardando, ativo ou bloqueado) da solicitação, ou null. */
export async function getOpenByRequest(laborRequestId, transaction = null) {
    const request = transaction ? new sql.Request(transaction) : (await poolPromise).request();
    const result = await request
        .input('labor_request_id', sql.Int, laborRequestId)
        .query(`
            SELECT ${ASSIGNMENT_FIELDS}
            FROM labor_request_suppliers AS l
            ${ASSIGNMENT_JOINS}
            WHERE l.labor_request_id = @labor_request_id AND l.[status] IN (0, 1, 2)
        `);
    return result.recordset[0] ?? null;
}

/** Todos os vínculos da solicitação (histórico), do mais novo para o mais antigo. */
export async function listByRequest(laborRequestId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('labor_request_id', sql.Int, laborRequestId)
        .query(`
            SELECT ${ASSIGNMENT_FIELDS}
            FROM labor_request_suppliers AS l
            ${ASSIGNMENT_JOINS}
            WHERE l.labor_request_id = @labor_request_id
            ORDER BY l.created_at DESC, l.id DESC
        `);
    return result.recordset;
}

/** Vínculo pelo token do link (/fase2/<token>), ou null. */
export async function getByToken(token) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('token', sql.VarChar(200), token)
        .query(`
            SELECT ${ASSIGNMENT_FIELDS}
            FROM labor_request_suppliers AS l
            ${ASSIGNMENT_JOINS}
            WHERE l.invite_token = @token
        `);
    return result.recordset[0] ?? null;
}

/**
 * Vínculos abertos do fornecedor (portal, "Meus contratos"), com o resumo dos documentos
 * enviados na solicitação.
 */
export async function listOpenBySupplier(supplierId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('supplier_id', sql.Int, supplierId)
        .query(`
            SELECT
                ${ASSIGNMENT_FIELDS},
                ISNULL(emp.employees, 0)   AS employees,
                ISNULL(docs.total, 0)      AS documents_total,
                ISNULL(docs.pending, 0)    AS documents_pending,
                ISNULL(docs.approved, 0)   AS documents_approved,
                ISNULL(docs.returned, 0)   AS documents_returned,
                ISNULL(docs.expired, 0)    AS documents_expired
            FROM labor_request_suppliers AS l
            ${ASSIGNMENT_JOINS}
            OUTER APPLY (
                SELECT COUNT(*) AS employees
                FROM employees AS e
                WHERE e.supplier_id = l.supplier_id AND e.labor_request_id = l.labor_request_id
            ) AS emp
            OUTER APPLY (
                SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN d.[status] IN (0, 1) THEN 1 ELSE 0 END) AS pending,
                    SUM(CASE WHEN d.[status] = 2 THEN 1 ELSE 0 END)      AS approved,
                    SUM(CASE WHEN d.[status] IN (3, 4) THEN 1 ELSE 0 END) AS returned,
                    SUM(CASE WHEN d.[status] = 5 THEN 1 ELSE 0 END)      AS expired
                FROM documents AS d
                WHERE d.supplier_id = l.supplier_id
                  AND d.labor_request_id = l.labor_request_id
                  AND d.is_current = 1
            ) AS docs
            WHERE l.supplier_id = @supplier_id AND l.[status] IN (0, 1, 2)
            ORDER BY l.created_at DESC
        `);
    return result.recordset;
}

/** Declaração do vínculo, com o nome e a categoria de cada documento. */
export async function getDeclaration(assignmentId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, assignmentId)
        .query(`
            SELECT
                d.document_type_id,
                dt.[name] AS document_type_name,
                dt.category,
                d.has_document,
                d.employee_count
            FROM labor_request_supplier_declarations AS d
            INNER JOIN document_types AS dt ON dt.id = d.document_type_id
            WHERE d.labor_request_supplier_id = @id
            ORDER BY dt.category ASC, dt.[name] ASC
        `);
    return result.recordset;
}

// ─────────────────────────────────────────────
// Escrita
// ─────────────────────────────────────────────

/** Cria o vínculo (convite). supplierId já vem quando o e-mail é de um usuário do portal. */
export async function insert(transaction, { laborRequestId, supplierId, inviteEmail, inviteToken, deadlineAt, createdBy }) {
    const result = await new sql.Request(transaction)
        .input('labor_request_id', sql.Int, laborRequestId)
        .input('supplier_id', sql.Int, supplierId ?? null)
        .input('invite_email', sql.NVarChar(200), inviteEmail)
        .input('invite_token', sql.VarChar(200), inviteToken)
        .input('deadline_at', sql.DateTime2(0), deadlineAt)
        .input('created_by', sql.Int, createdBy)
        .query(`
            INSERT INTO labor_request_suppliers
                (labor_request_id, supplier_id, invite_email, invite_token, deadline_at, [status],
                 created_by, linked_at)
            OUTPUT INSERTED.id
            VALUES
                (@labor_request_id, @supplier_id, @invite_email, @invite_token, @deadline_at, 0,
                 @created_by, CASE WHEN @supplier_id IS NULL THEN NULL ELSE GETDATE() END)
        `);
    return result.recordset[0]?.id ?? null;
}

/**
 * Vincula o fornecedor a um convite ainda sem fornecedor (abriu o link logado).
 * Só vale para convite aguardando (status 0) e sem fornecedor. Retorna true se vinculou.
 */
export async function claim(assignmentId, supplierId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, assignmentId)
        .input('supplier_id', sql.Int, supplierId)
        .query(`
            UPDATE labor_request_suppliers
            SET supplier_id = @supplier_id, linked_at = GETDATE()
            WHERE id = @id AND supplier_id IS NULL AND [status] = 0
        `);
    return result.rowsAffected[0] > 0;
}

/**
 * Vincula ao fornecedor os convites aguardando, sem fornecedor, feitos para algum dos
 * e-mails dele (ex.: se cadastrou sem abrir o link). Só conta e-mail CONFIRMADO de um
 * usuário ativo do próprio fornecedor (confirmado = entrou com o código enviado a ele).
 * Retorna quantos vinculou.
 */
export async function claimByEmails(supplierId, emails = []) {
    if (emails.length === 0) return 0;
    const pool = await poolPromise;
    const request = pool.request().input('supplier_id', sql.Int, supplierId);
    const params = emails.map((email, index) => {
        request.input(`email${index}`, sql.NVarChar(200), email);
        return `@email${index}`;
    });
    const result = await request.query(`
        UPDATE l
        SET supplier_id = @supplier_id, linked_at = GETDATE()
        FROM labor_request_suppliers AS l
        WHERE l.supplier_id IS NULL
          AND l.[status] = 0
          AND l.invite_email IN (${params.join(', ')})
          AND EXISTS (
              SELECT 1 FROM supplier_users AS su
              WHERE su.supplier_id = @supplier_id
                AND su.email = l.invite_email
                AND su.is_active = 1
                AND su.email_verified_at IS NOT NULL
          )
    `);
    return result.rowsAffected[0] ?? 0;
}

/** Grava a declaração (substitui a anterior). rows: [{ documentTypeId, hasDocument?, employeeCount? }] */
export async function saveDeclaration(transaction, assignmentId, rows) {
    await new sql.Request(transaction)
        .input('id', sql.Int, assignmentId)
        .query('DELETE FROM labor_request_supplier_declarations WHERE labor_request_supplier_id = @id');

    for (const row of rows) {
        await new sql.Request(transaction)
            .input('id', sql.Int, assignmentId)
            .input('document_type_id', sql.Int, row.documentTypeId)
            .input('has_document', sql.Bit, row.hasDocument ?? null)
            .input('employee_count', sql.Int, row.employeeCount ?? null)
            .query(`
                INSERT INTO labor_request_supplier_declarations
                    (labor_request_supplier_id, document_type_id, has_document, employee_count)
                VALUES (@id, @document_type_id, @has_document, @employee_count)
            `);
    }
}

/**
 * Declaração assinada: status 1 (ativo) ou 2 (bloqueado), com quem assinou, IP e navegador.
 * Só muda vínculo que ainda aguardava a declaração. Retorna true se mudou.
 */
export async function markDeclared(transaction, assignmentId, { status, declaredBy, ipAddress, userAgent, code, termVersion, termText }) {
    const result = await new sql.Request(transaction)
        .input('id', sql.Int, assignmentId)
        .input('status', sql.TinyInt, status)
        .input('declared_by', sql.Int, declaredBy)
        .input('ip', sql.VarChar(45), ipAddress ?? null)
        .input('ua', sql.NVarChar(500), userAgent ? String(userAgent).slice(0, 500) : null)
        .input('code', sql.VarChar(20), code ?? null)
        .input('term_version', sql.VarChar(20), termVersion ?? null)
        .input('term_text', sql.NVarChar(sql.MAX), termText ?? null)
        .query(`
            UPDATE labor_request_suppliers
            SET [status] = @status,
                declared_at = GETDATE(),
                declared_by = @declared_by,
                acceptance_ip = @ip,
                acceptance_user_agent = @ua,
                declaration_code = @code,
                term_version = @term_version,
                term_text = @term_text,
                blocked_at = CASE WHEN @status = 2 THEN GETDATE() ELSE NULL END
            WHERE id = @id AND [status] = 0
        `);
    return result.rowsAffected[0] > 0;
}

/** Encerra o vínculo (reenviado ou fornecedor trocado). Retorna true se encerrou. */
export async function end(transaction, assignmentId, { endedBy, reason, comment }) {
    const result = await new sql.Request(transaction)
        .input('id', sql.Int, assignmentId)
        .input('ended_by', sql.Int, endedBy)
        .input('end_reason', sql.TinyInt, reason)
        .input('end_comment', sql.NVarChar(1000), comment ?? null)
        .query(`
            UPDATE labor_request_suppliers
            SET [status] = 3,
                ended_at = GETDATE(),
                ended_by = @ended_by,
                end_reason = @end_reason,
                end_comment = @end_comment
            WHERE id = @id AND [status] IN (0, 1, 2)
        `);
    return result.rowsAffected[0] > 0;
}

/** Novo prazo dos documentos iniciais (vínculo aberto). */
export async function updateDeadline(transaction, assignmentId, deadlineAt) {
    const result = await new sql.Request(transaction)
        .input('id', sql.Int, assignmentId)
        .input('deadline_at', sql.DateTime2(0), deadlineAt)
        .query(`
            UPDATE labor_request_suppliers
            SET deadline_at = @deadline_at
            WHERE id = @id AND [status] IN (0, 1)
        `);
    return result.rowsAffected[0] > 0;
}
