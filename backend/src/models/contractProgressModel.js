import { sql } from '../config/dbConfig.js';

/**
 * Andamento dos documentos iniciais de um contrato (vínculo ativo de um fornecedor numa
 * solicitação). Tudo roda na transação de quem chamou.
 */

/** Vínculo ATIVO (declaração assinada) do fornecedor na solicitação, com o status da solicitação. */
export async function getActiveAssignment(transaction, laborRequestId, supplierId) {
    const result = await new sql.Request(transaction)
        .input('labor_request_id', sql.Int, laborRequestId)
        .input('supplier_id', sql.Int, supplierId)
        .query(`
            SELECT l.id, l.labor_request_id, l.supplier_id, lr.[status] AS labor_request_status
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
    const result = await new sql.Request(transaction)
        .input('id', sql.Int, documentId)
        .query(`
            SELECT supplier_id, labor_request_id, employee_id, reference_month
            FROM documents
            WHERE id = @id
        `);
    return result.recordset[0] ?? null;
}

/**
 * O que ainda falta o RH aprovar nos documentos iniciais (entregas atuais, sem os mensais):
 * - missingCompany: documentos da empresa declarados sem entrega aprovada;
 * - missingEmployeeTypes: documentos de colaborador (NRs / outros) com menos colaboradores
 *   aprovados do que o fornecedor declarou;
 * - missingBasics: documentos básicos exigidos (de todo colaborador) sem aprovação, somando
 *   os colaboradores cadastrados no contrato (menos os desligados).
 */
export async function getInitialDocumentationGaps(transaction, { assignmentId, laborRequestId, supplierId }) {
    const result = await new sql.Request(transaction)
        .input('assignment_id', sql.Int, assignmentId)
        .input('labor_request_id', sql.Int, laborRequestId)
        .input('supplier_id', sql.Int, supplierId)
        .query(`
            WITH approved AS (
                SELECT d.document_type_id, d.employee_id
                FROM documents AS d
                WHERE d.supplier_id = @supplier_id
                  AND d.labor_request_id = @labor_request_id
                  AND d.reference_month IS NULL
                  AND d.is_current = 1
                  AND d.[status] = 2
            ),
            basics AS (
                SELECT dt.id
                FROM labor_request_documents AS lrd
                INNER JOIN document_types AS dt ON dt.id = lrd.document_type_id
                WHERE lrd.labor_request_id = @labor_request_id
                  AND dt.category = 1
                  AND dt.is_active = 1
            )
            SELECT
                (SELECT COUNT(*)
                 FROM labor_request_supplier_declarations AS x
                 WHERE x.labor_request_supplier_id = @assignment_id
                   AND x.has_document = 1
                   AND NOT EXISTS (
                       SELECT 1 FROM approved AS a
                       WHERE a.document_type_id = x.document_type_id AND a.employee_id IS NULL
                   )) AS missing_company,
                (SELECT COUNT(*)
                 FROM labor_request_supplier_declarations AS x
                 WHERE x.labor_request_supplier_id = @assignment_id
                   AND x.employee_count IS NOT NULL
                   AND (SELECT COUNT(DISTINCT a.employee_id) FROM approved AS a
                        WHERE a.document_type_id = x.document_type_id AND a.employee_id IS NOT NULL)
                       < x.employee_count) AS missing_employee_types,
                (SELECT COUNT(*)
                 FROM employees AS e
                 CROSS JOIN basics AS b
                 WHERE e.supplier_id = @supplier_id
                   AND e.labor_request_id = @labor_request_id
                   AND ISNULL(e.[status], 0) <> 5
                   AND NOT EXISTS (
                       SELECT 1 FROM approved AS a
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
