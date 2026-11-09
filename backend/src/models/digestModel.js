// Resumo do RH: o que aconteceu num período (documentos enviados / reenviados e outros avisos)
import { sql, poolPromise } from '../config/dbConfig.js';
import { DEPARTMENTS } from '../constants/departments.js';

/** E-mails dos usuários ativos do RH. */
export async function rhEmails() {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('department', sql.TinyInt, DEPARTMENTS.RH)
        .query('SELECT email FROM users WHERE department = @department AND ISNULL(is_active, 1) = 1 ORDER BY [name]');
    return result.recordset.map((row) => row.email);
}

/**
 * Documentos que chegaram no período (entregas atuais: se o fornecedor mandou duas vezes no
 * período, vale a última), com fornecedor, contrato, colaborador e competência.
 */
export async function documentsReceived(from, to) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('from', sql.DateTime2, from)
        .input('to', sql.DateTime2, to)
        .query(`
            SELECT
                d.id, d.supplier_id, d.labor_request_id, d.version, d.uploaded_at, d.reference_month, d.[status],
                dt.[name]          AS document_type_name,
                dt.category,
                e.full_name        AS employee_name,
                s.razao_social     AS supplier_name,
                lr.title           AS labor_request_title,
                lr.contract_number
            FROM documents AS d
            INNER JOIN document_types AS dt ON dt.id = d.document_type_id
            INNER JOIN suppliers AS s ON s.id = d.supplier_id
            LEFT JOIN employees AS e ON e.id = d.employee_id
            LEFT JOIN labor_requests AS lr ON lr.id = d.labor_request_id
            WHERE d.uploaded_at >= @from
              AND d.uploaded_at < @to
              AND d.is_current = 1
            ORDER BY s.razao_social, lr.contract_number, d.uploaded_at
        `);
    return result.recordset;
}

/** Declarações assinadas no período (contrato começando ou bloqueado por "não tenho"). */
export async function declarationsSigned(from, to) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('from', sql.DateTime2, from)
        .input('to', sql.DateTime2, to)
        .query(`
            SELECT l.id, l.[status], l.declared_at, l.labor_request_id,
                   s.razao_social AS supplier_name, lr.title AS labor_request_title, lr.contract_number
            FROM labor_request_suppliers AS l
            INNER JOIN labor_requests AS lr ON lr.id = l.labor_request_id
            LEFT JOIN suppliers AS s ON s.id = l.supplier_id
            WHERE l.declared_at >= @from AND l.declared_at < @to
            ORDER BY l.declared_at
        `);
    return result.recordset;
}

/** Prazos dos documentos iniciais que venceram no período (com o contrato ainda pendente). */
export async function deadlinesExpired(from, to) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('from', sql.DateTime2, from)
        .input('to', sql.DateTime2, to)
        .query(`
            SELECT l.id, l.deadline_at, l.labor_request_id, l.invite_email,
                   s.razao_social AS supplier_name, lr.title AS labor_request_title, lr.contract_number
            FROM labor_request_suppliers AS l
            INNER JOIN labor_requests AS lr ON lr.id = l.labor_request_id
            LEFT JOIN suppliers AS s ON s.id = l.supplier_id
            WHERE l.deadline_at >= @from AND l.deadline_at < @to
              AND l.[status] IN (0, 1)
              AND lr.[status] = 5
            ORDER BY l.deadline_at
        `);
    return result.recordset;
}
