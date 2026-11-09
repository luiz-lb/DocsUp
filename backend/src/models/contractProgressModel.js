import { sql, poolPromise } from '../config/dbConfig.js';

/**
 * Andamento dos documentos iniciais de um contrato (vínculo ativo de um fornecedor numa
 * solicitação). Com transação, roda nela; sem, usa o pool (agendador).
 */

async function requestFor(transaction) {
    return transaction ? new sql.Request(transaction) : (await poolPromise).request();
}

// Status de entrega que contam: aprovado (para Serviço em andamento) ou enviado (para os
// lembretes de prazo: pendente, validando e aprovado; reprovado / reenvio / vencido não contam)
export const APPROVED_ONLY = [2];
export const SENT_STATUSES = [0, 1, 2];

function statusList(request, statuses) {
    return statuses.map((status, index) => {
        request.input(`st${index}`, sql.TinyInt, status);
        return `@st${index}`;
    }).join(', ');
}

/** Vínculo ATIVO (declaração assinada) do fornecedor na solicitação, com o status da solicitação. */
export async function getActiveAssignment(transaction, laborRequestId, supplierId) {
    const request = await requestFor(transaction);
    const result = await request
        .input('labor_request_id', sql.Int, laborRequestId)
        .input('supplier_id', sql.Int, supplierId)
        .query(`
            SELECT l.id, l.labor_request_id, l.supplier_id, l.invite_email, l.invite_token,
                   lr.[status] AS labor_request_status, lr.title AS labor_request_title,
                   lr.contract_number, lr.[location] AS labor_request_location
            FROM labor_request_suppliers AS l
            INNER JOIN labor_requests AS lr ON lr.id = l.labor_request_id
            WHERE l.labor_request_id = @labor_request_id
              AND l.supplier_id = @supplier_id
              AND l.[status] = 1
        `);
    return result.recordset[0] ?? null;
}

/** Fornecedor, solicitação e competência de um documento (lido na transação). */
export async function getDocumentSlot(transaction, documentId) {
    const request = await requestFor(transaction);
    const result = await request
        .input('id', sql.Int, documentId)
        .query(`
            SELECT supplier_id, labor_request_id, employee_id, reference_month
            FROM documents
            WHERE id = @id
        `);
    return result.recordset[0] ?? null;
}

const COUNTED_DOCUMENTS = (statuses) => `
    counted AS (
        SELECT d.document_type_id, d.employee_id
        FROM documents AS d
        WHERE d.supplier_id = @supplier_id
          AND d.labor_request_id = @labor_request_id
          AND d.reference_month IS NULL
          AND d.is_current = 1
          AND d.[status] IN (${statuses})
    ),
    basics AS (
        SELECT dt.id, dt.[name]
        FROM labor_request_documents AS lrd
        INNER JOIN document_types AS dt ON dt.id = lrd.document_type_id
        WHERE lrd.labor_request_id = @labor_request_id
          AND dt.category = 1
          AND dt.is_active = 1
    )`;

/**
 * O que ainda falta nos documentos iniciais (entregas atuais, sem os mensais), contando só as
 * entregas em `statuses` (padrão: aprovadas):
 * - missingCompany: documentos da empresa declarados sem entrega;
 * - missingEmployeeTypes: documentos de colaborador (NRs / outros) com menos colaboradores do
 *   que o fornecedor declarou;
 * - missingBasics: documentos básicos exigidos (de todo colaborador) que faltam, somando os
 *   colaboradores cadastrados no contrato (menos os desligados).
 */
export async function getInitialDocumentationGaps(transaction, { assignmentId, laborRequestId, supplierId }, statuses = APPROVED_ONLY) {
    const request = await requestFor(transaction);
    request
        .input('assignment_id', sql.Int, assignmentId)
        .input('labor_request_id', sql.Int, laborRequestId)
        .input('supplier_id', sql.Int, supplierId);
    const result = await request.query(`
            WITH ${COUNTED_DOCUMENTS(statusList(request, statuses))}
            SELECT
                (SELECT COUNT(*)
                 FROM labor_request_supplier_declarations AS x
                 WHERE x.labor_request_supplier_id = @assignment_id
                   AND x.has_document = 1
                   AND NOT EXISTS (
                       SELECT 1 FROM counted AS a
                       WHERE a.document_type_id = x.document_type_id AND a.employee_id IS NULL
                   )) AS missing_company,
                (SELECT COUNT(*)
                 FROM labor_request_supplier_declarations AS x
                 WHERE x.labor_request_supplier_id = @assignment_id
                   AND x.employee_count IS NOT NULL
                   AND (SELECT COUNT(DISTINCT a.employee_id) FROM counted AS a
                        WHERE a.document_type_id = x.document_type_id AND a.employee_id IS NOT NULL)
                       < x.employee_count) AS missing_employee_types,
                (SELECT COUNT(*)
                 FROM employees AS e
                 CROSS JOIN basics AS b
                 WHERE e.supplier_id = @supplier_id
                   AND e.labor_request_id = @labor_request_id
                   AND ISNULL(e.[status], 0) <> 5
                   AND NOT EXISTS (
                       SELECT 1 FROM counted AS a
                       WHERE a.document_type_id = b.id AND a.employee_id = e.id
                   )) AS missing_basics
        `);
    const row = result.recordset[0];
    return {
        missingCompany: row.missing_company,
        missingEmployeeTypes: row.missing_employee_types,
        missingBasics: row.missing_basics,
    };
}

/**
 * O que falta enviar, com nomes (para os avisos de prazo): documentos da empresa, tipos de
 * colaborador com "enviados de declarados" e colaboradores sem algum básico.
 */
export async function getInitialDocumentationMissing(transaction, { assignmentId, laborRequestId, supplierId }, statuses = SENT_STATUSES) {
    const request = await requestFor(transaction);
    request
        .input('assignment_id', sql.Int, assignmentId)
        .input('labor_request_id', sql.Int, laborRequestId)
        .input('supplier_id', sql.Int, supplierId);
    const counted = COUNTED_DOCUMENTS(statusList(request, statuses));
    const result = await request.query(`
            WITH ${counted}
            SELECT 'company' AS kind, dt.[name] AS name, NULL AS sent, NULL AS declared
            FROM labor_request_supplier_declarations AS x
            INNER JOIN document_types AS dt ON dt.id = x.document_type_id
            WHERE x.labor_request_supplier_id = @assignment_id
              AND x.has_document = 1
              AND NOT EXISTS (SELECT 1 FROM counted AS a WHERE a.document_type_id = x.document_type_id AND a.employee_id IS NULL)
            UNION ALL
            SELECT 'employee', dt.[name], c.sent, x.employee_count
            FROM labor_request_supplier_declarations AS x
            INNER JOIN document_types AS dt ON dt.id = x.document_type_id
            CROSS APPLY (
                SELECT COUNT(DISTINCT a.employee_id) AS sent FROM counted AS a
                WHERE a.document_type_id = x.document_type_id AND a.employee_id IS NOT NULL
            ) AS c
            WHERE x.labor_request_supplier_id = @assignment_id
              AND x.employee_count IS NOT NULL
              AND c.sent < x.employee_count
            UNION ALL
            SELECT 'basics', e.full_name, COUNT(*), NULL
            FROM employees AS e
            CROSS JOIN basics AS b
            WHERE e.supplier_id = @supplier_id
              AND e.labor_request_id = @labor_request_id
              AND ISNULL(e.[status], 0) <> 5
              AND NOT EXISTS (SELECT 1 FROM counted AS a WHERE a.document_type_id = b.id AND a.employee_id = e.id)
            GROUP BY e.full_name
        `);
    const rows = result.recordset;
    return {
        company: rows.filter((row) => row.kind === 'company').map((row) => row.name),
        employee: rows.filter((row) => row.kind === 'employee').map((row) => ({ name: row.name, sent: row.sent, declared: row.declared })),
        basics: rows.filter((row) => row.kind === 'basics').map((row) => ({ employee: row.name, missing: row.sent })),
    };
}
