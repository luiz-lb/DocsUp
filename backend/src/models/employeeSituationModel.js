// importando a configuração do banco de dados
import { sql, poolPromise } from '../config/dbConfig.js';

/**
 * Colaboradores com a situação e o resumo dos documentos atuais, para o RH / Segurança
 * (Docs de Fornecedores, aba Colaboradores). retained_by: documentos da EMPRESA vencidos
 * (o motivo do "Retido por pendência").
 *
 * @param {object} options
 * @param {string} [options.search] - Nome, CPF ou fornecedor.
 * @param {number} [options.status] - Situação (0 a 6).
 */
export async function listEmployeeSituations({ search = '', status } = {}) {
    const pool = await poolPromise;
    const request = pool.request();
    const conditions = [];

    if (search) {
        request.input('search', sql.NVarChar(210), `%${search}%`);
        conditions.push('(e.full_name LIKE @search OR e.cpf LIKE @search OR s.razao_social LIKE @search)');
    }
    if (status !== undefined) {
        request.input('status', sql.TinyInt, status);
        conditions.push('e.[status] = @status');
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await request.query(`
        SELECT
            e.id,
            e.full_name,
            e.cpf,
            e.role_function,
            e.[status],
            e.integration_at,
            e.supplier_id,
            s.razao_social   AS supplier_name,
            e.labor_request_id,
            lr.title         AS labor_request_title,
            lr.[location]    AS labor_request_location,
            ISNULL(docs.total, 0)    AS documents_total,
            ISNULL(docs.approved, 0) AS documents_approved,
            ISNULL(docs.pending, 0)  AS documents_pending,
            ISNULL(docs.returned, 0) AS documents_returned,
            ISNULL(docs.expired, 0)  AS documents_expired,
            docs.next_expiry,
            company.retained_by
        FROM employees AS e
        INNER JOIN suppliers      AS s  ON s.id  = e.supplier_id
        LEFT  JOIN labor_requests AS lr ON lr.id = e.labor_request_id
        OUTER APPLY (
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN d.[status] = 2 THEN 1 ELSE 0 END)      AS approved,
                SUM(CASE WHEN d.[status] IN (0, 1) THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN d.[status] IN (3, 4) THEN 1 ELSE 0 END) AS returned,
                SUM(CASE WHEN d.[status] = 5 THEN 1 ELSE 0 END)      AS expired,
                MIN(CASE WHEN d.[status] <> 5 THEN d.expires_at END)  AS next_expiry
            FROM documents AS d
            WHERE d.employee_id = e.id AND d.is_current = 1
        ) AS docs
        OUTER APPLY (
            SELECT STRING_AGG(dt.[name], ', ') AS retained_by
            FROM documents AS d
            INNER JOIN document_types AS dt ON dt.id = d.document_type_id
            WHERE d.employee_id IS NULL
              AND d.supplier_id = e.supplier_id
              AND d.labor_request_id = e.labor_request_id
              AND d.is_current = 1
              AND d.[status] = 5
        ) AS company
        ${whereClause}
        ORDER BY s.razao_social ASC, e.full_name ASC
    `);
    return result.recordset;
}

export async function getEmployeeSituation(id) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT id, full_name, [status], integration_at FROM employees WHERE id = @id');
    return result.recordset[0] ?? null;
}

/** Muda a situação; integration_at só é gravado quando vier (agendamento da integração). */
export async function updateEmployeeSituation(transaction, id, { status, integrationAt }) {
    const request = new sql.Request(transaction)
        .input('id', sql.Int, id)
        .input('status', sql.TinyInt, status)
        .input('integration_at', sql.DateTime2(0), integrationAt ?? null);
    await request.query(`
        UPDATE employees
        SET [status] = @status,
            integration_at = COALESCE(@integration_at, integration_at),
            updated_at = GETDATE()
        WHERE id = @id
    `);
}

/**
 * Rotina diária (00:01). Tudo por conjunto, com a auditoria (autor: sistema) no mesmo lote:
 *  1. documento atual com validade antes de hoje → Expirado (5);
 *  2. documento da EMPRESA expirado (mesmo fornecedor e solicitação) → TODOS os colaboradores
 *     ficam Retido por pendência (6), menos os desligados. A retenção vale mais que os outros
 *     passos: a obra pode ser paralisada pela fiscalização;
 *  3. colaborador com documento próprio expirado → Pendente de documentos (0);
 *  4. colaborador com documento próprio vencendo em até 1 mês → Documento a vencer (4).
 * Os passos 3 e 4 só mexem em quem estava em andamento (Documentação OK, Integração agendada,
 * Liberado ou a vencer). Quem já está retido ou desligado não muda.
 *
 * @param {Date} today - hoje (data local)
 * @param {Date} soon  - hoje + 1 mês (data local)
 * @returns {Promise<{ expiredDocuments: number, employees: number }>}
 */
export async function runDailyDocumentCheck(transaction, { today, soon }) {
    const result = await new sql.Request(transaction)
        .input('today', sql.Date, today)
        .input('soon', sql.Date, soon)
        .query(`
            DECLARE @expired TABLE (id INT, old_status TINYINT);
            DECLARE @employees TABLE (id INT, old_status TINYINT, new_status TINYINT);

            -- 1) Documentos vencidos
            UPDATE documents
            SET [status] = 5, updated_at = GETDATE()
            OUTPUT inserted.id, deleted.[status] INTO @expired
            WHERE is_current = 1
              AND expires_at IS NOT NULL
              AND expires_at < @today
              AND ISNULL([status], 0) <> 5;

            -- 2) Documento da empresa vencido → todos os colaboradores (menos desligados) retidos
            UPDATE e
            SET [status] = 6, updated_at = GETDATE()
            OUTPUT inserted.id, deleted.[status], inserted.[status] INTO @employees
            FROM employees AS e
            WHERE ISNULL(e.[status], 0) IN (0, 1, 2, 3, 4)
              AND EXISTS (
                  SELECT 1 FROM documents AS d
                  WHERE d.employee_id IS NULL
                    AND d.supplier_id = e.supplier_id
                    AND d.labor_request_id = e.labor_request_id
                    AND d.is_current = 1
                    AND d.[status] = 5
              );

            -- 3) Documento do próprio colaborador vencido → Pendente de documentos
            UPDATE e
            SET [status] = 0, updated_at = GETDATE()
            OUTPUT inserted.id, deleted.[status], inserted.[status] INTO @employees
            FROM employees AS e
            WHERE e.[status] IN (1, 2, 3, 4)
              AND EXISTS (
                  SELECT 1 FROM documents AS d
                  WHERE d.employee_id = e.id AND d.is_current = 1 AND d.[status] = 5
              );

            -- 4) Documento do colaborador vencendo em até 1 mês → Documento a vencer
            UPDATE e
            SET [status] = 4, updated_at = GETDATE()
            OUTPUT inserted.id, deleted.[status], inserted.[status] INTO @employees
            FROM employees AS e
            WHERE e.[status] IN (1, 2, 3)
              AND EXISTS (
                  SELECT 1 FROM documents AS d
                  WHERE d.employee_id = e.id
                    AND d.is_current = 1
                    AND ISNULL(d.[status], 0) <> 5
                    AND d.expires_at IS NOT NULL
                    AND d.expires_at >= @today
                    AND d.expires_at <= @soon
              );

            -- Auditoria (autor: sistema)
            INSERT INTO audit_log (actor_type, actor_id, [action], entity_type, entity_id, old_values, new_values)
            SELECT 2, NULL, 'document.expired', 'document', id,
                   CONCAT('{"status":', ISNULL(old_status, 0), '}'), '{"status":5}'
            FROM @expired;

            INSERT INTO audit_log (actor_type, actor_id, [action], entity_type, entity_id, old_values, new_values)
            SELECT 2, NULL, 'employee.status_change', 'employee', id,
                   CONCAT('{"status":', ISNULL(old_status, 0), '}'), CONCAT('{"status":', new_status, '}')
            FROM @employees;

            SELECT
                (SELECT COUNT(*) FROM @expired)   AS expired_documents,
                (SELECT COUNT(*) FROM @employees) AS employees;
        `);

    const counts = result.recordset[0] ?? {};
    return { expiredDocuments: counts.expired_documents ?? 0, employees: counts.employees ?? 0 };
}
