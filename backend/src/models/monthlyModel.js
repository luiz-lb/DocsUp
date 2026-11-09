// Documentos trabalhistas mensais (document_types.category = 4)
import { sql, poolPromise } from '../config/dbConfig.js';

// ─────────────────────────────────────────────
// Catálogo e documentos mensais
// ─────────────────────────────────────────────

// Contratos por consulta: 2 parâmetros cada, abaixo do limite de 2100 do SQL Server
const PAIRS_PER_QUERY = 500;

/** Roda a consulta em lotes de contratos e junta os resultados. */
async function inBatches(pairs, query) {
    const rows = [];
    for (let start = 0; start < pairs.length; start += PAIRS_PER_QUERY) {
        rows.push(...await query(pairs.slice(start, start + PAIRS_PER_QUERY)));
    }
    return rows;
}

/** Tipos mensais ativos (valem para todos os contratos). scope 0 = empresa, 1 = colaborador. */
export async function getActiveMonthlyTypes() {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT id, [name], [description], scope, has_expiration, validity_days
        FROM document_types
        WHERE category = 4 AND is_active = 1
        ORDER BY scope ASC, [name] ASC
    `);
    return result.recordset;
}

/**
 * Documentos mensais atuais de um conjunto de contratos (fornecedor + solicitação), com a
 * observação da última análise do RH. pairs: [{ supplierId, laborRequestId }].
 * Opcionalmente só de um mês (referenceMonth: Date no dia 1).
 */
export async function listCurrentMonthlyDocuments(pairs, referenceMonth = null) {
    return inBatches(pairs, (batch) => currentMonthlyDocuments(batch, referenceMonth));
}

async function currentMonthlyDocuments(pairs, referenceMonth) {
    if (pairs.length === 0) return [];
    const pool = await poolPromise;
    const request = pool.request().input('reference_month', sql.Date, referenceMonth);
    const conditions = pairs.map((pair, index) => {
        request.input(`s${index}`, sql.Int, pair.supplierId);
        request.input(`r${index}`, sql.Int, pair.laborRequestId);
        return `(d.supplier_id = @s${index} AND d.labor_request_id = @r${index})`;
    });
    const result = await request.query(`
        SELECT
            d.id,
            d.supplier_id,
            d.labor_request_id,
            d.document_type_id,
            d.employee_id,
            d.reference_month,
            d.[status],
            d.file_name,
            d.uploaded_at,
            d.[version],
            review.manual_comments AS observation
        FROM documents AS d
        OUTER APPLY (
            SELECT TOP (1) v.manual_comments
            FROM document_validations AS v
            WHERE v.document_id = d.id AND v.validation_type = 2
            ORDER BY v.id DESC
        ) AS review
        WHERE d.is_current = 1
          AND d.reference_month IS NOT NULL
          AND (@reference_month IS NULL OR d.reference_month = @reference_month)
          AND (${conditions.join(' OR ')})
    `);
    return result.recordset;
}

/**
 * Colaboradores dos contratos (menos os desligados), com a data de cadastro: um colaborador
 * cadastrado depois do mês não deve aquele mês. pairs: [{ supplierId, laborRequestId }].
 */
export async function listEmployeesForMonthly(pairs) {
    return inBatches(pairs, employeesForMonthly);
}

async function employeesForMonthly(pairs) {
    if (pairs.length === 0) return [];
    const pool = await poolPromise;
    const request = pool.request();
    const conditions = pairs.map((pair, index) => {
        request.input(`s${index}`, sql.Int, pair.supplierId);
        request.input(`r${index}`, sql.Int, pair.laborRequestId);
        return `(e.supplier_id = @s${index} AND e.labor_request_id = @r${index})`;
    });
    const result = await request.query(`
        SELECT e.id, e.full_name, e.cpf, e.role_function, e.supplier_id, e.labor_request_id, e.created_at
        FROM employees AS e
        WHERE ISNULL(e.[status], 0) <> 5
          AND (${conditions.join(' OR ')})
        ORDER BY e.full_name ASC
    `);
    return result.recordset;
}

/** Um colaborador do contrato (fornecedor + solicitação), ou null. */
export async function getContractEmployee(employeeId, supplierId, laborRequestId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, employeeId)
        .input('supplier_id', sql.Int, supplierId)
        .input('labor_request_id', sql.Int, laborRequestId)
        .query(`
            SELECT id, full_name, [status]
            FROM employees
            WHERE id = @id AND supplier_id = @supplier_id AND labor_request_id = @labor_request_id
        `);
    return result.recordset[0] ?? null;
}

/**
 * Contratos com fornecedor ativo (declaração assinada), para o acompanhamento do RH:
 * solicitação (início, conclusão, contrato) e fornecedor. Solicitações canceladas ficam de fora.
 */
export async function listActiveContracts() {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT
            l.id                AS assignment_id,
            l.supplier_id,
            s.razao_social      AS supplier_name,
            l.labor_request_id,
            l.created_at        AS assignment_created_at,
            l.invite_email,
            l.invite_token,
            lr.title            AS labor_request_title,
            lr.contract_number,
            lr.[location]       AS labor_request_location,
            lr.start_date,
            lr.[status]         AS labor_request_status,
            lr.concluded_at
        FROM labor_request_suppliers AS l
        INNER JOIN labor_requests AS lr ON lr.id = l.labor_request_id
        INNER JOIN suppliers      AS s  ON s.id  = l.supplier_id
        WHERE l.[status] = 1
          AND lr.[status] <> 7
        ORDER BY lr.contract_number ASC, s.razao_social ASC
    `);
    return result.recordset;
}
