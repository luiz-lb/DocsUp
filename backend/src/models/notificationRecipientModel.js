// Dados e destinatários das notificações (lidos na transação da ação, quando houver)
import { sql, poolPromise } from '../config/dbConfig.js';

async function requestFor(transaction) {
    return transaction ? new sql.Request(transaction) : (await poolPromise).request();
}

/**
 * E-mails do fornecedor para os avisos do contrato: usuários ativos com o e-mail confirmado
 * (entraram com o código). E-mail não confirmado não recebe: pode ser de outra empresa.
 */
export async function supplierUserEmails(transaction, supplierId) {
    if (!supplierId) return [];
    const request = await requestFor(transaction);
    const result = await request
        .input('supplier_id', sql.Int, supplierId)
        .query(`
            SELECT email FROM supplier_users
            WHERE supplier_id = @supplier_id AND is_active = 1 AND email_verified_at IS NOT NULL
            ORDER BY [role]
        `);
    return result.recordset.map((row) => row.email);
}

/** Destinatários do fornecedor de um vínculo: os usuários confirmados ou, sem eles, o e-mail indicado. */
export async function assignmentRecipients(transaction, { supplierId, inviteEmail }) {
    const emails = await supplierUserEmails(transaction, supplierId);
    return emails.length > 0 ? emails : [inviteEmail].filter(Boolean);
}

/** Documento para o aviso de reprovação / reenvio: tipo, colaborador, competência e contrato. */
export async function documentNotice(transaction, documentId) {
    const request = await requestFor(transaction);
    const result = await request
        .input('id', sql.Int, documentId)
        .query(`
            SELECT
                d.id, d.supplier_id, d.labor_request_id, d.reference_month,
                dt.[name]          AS document_type_name,
                e.full_name        AS employee_name,
                lr.title           AS labor_request_title,
                lr.contract_number,
                l.invite_token,
                l.invite_email
            FROM documents AS d
            INNER JOIN document_types AS dt ON dt.id = d.document_type_id
            LEFT JOIN employees AS e ON e.id = d.employee_id
            LEFT JOIN labor_requests AS lr ON lr.id = d.labor_request_id
            OUTER APPLY (
                SELECT TOP (1) x.invite_token, x.invite_email
                FROM labor_request_suppliers AS x
                WHERE x.labor_request_id = d.labor_request_id
                  AND x.supplier_id = d.supplier_id
                  AND x.[status] IN (0, 1, 2)
                ORDER BY x.id DESC
            ) AS l
            WHERE d.id = @id
        `);
    return result.recordset[0] ?? null;
}

/** Vínculo em aberto da solicitação (aguardando, ativo ou bloqueado), com a solicitação. */
export async function openAssignment(transaction, laborRequestId) {
    const request = await requestFor(transaction);
    const result = await request
        .input('labor_request_id', sql.Int, laborRequestId)
        .query(`
            SELECT TOP (1)
                l.id, l.supplier_id, l.invite_email, l.invite_token, l.deadline_at, l.[status],
                lr.title AS labor_request_title, lr.contract_number, lr.[location] AS labor_request_location
            FROM labor_request_suppliers AS l
            INNER JOIN labor_requests AS lr ON lr.id = l.labor_request_id
            WHERE l.labor_request_id = @labor_request_id AND l.[status] IN (0, 1, 2)
            ORDER BY l.id DESC
        `);
    return result.recordset[0] ?? null;
}

const DEADLINE_COLUMNS = `
    l.id, l.labor_request_id, l.supplier_id, l.invite_email, l.invite_token, l.deadline_at,
    l.[status], l.created_at,
    lr.title AS labor_request_title, lr.contract_number, lr.[location] AS labor_request_location,
    s.razao_social AS supplier_name,
    u.email AS created_by_email
`;

const DEADLINE_JOINS = `
    FROM labor_request_suppliers AS l
    INNER JOIN labor_requests AS lr ON lr.id = l.labor_request_id
    LEFT JOIN suppliers AS s ON s.id = l.supplier_id
    LEFT JOIN users AS u ON u.id = l.created_by
`;

/**
 * Prazo dos iniciais perto do fim: vínculo aguardando ou ativo, solicitação Pendente de
 * documentação, prazo nas próximas `hours` horas e o vínculo criado antes da hora do lembrete
 * (quem foi indicado com prazo menor que isso já recebeu o prazo no convite).
 */
export async function assignmentsNearDeadline(hours) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('hours', sql.Int, hours)
        .query(`
            SELECT ${DEADLINE_COLUMNS}
            ${DEADLINE_JOINS}
            WHERE l.[status] IN (0, 1)
              AND lr.[status] = 5
              AND l.deadline_at > GETDATE()
              AND l.deadline_at <= DATEADD(HOUR, @hours, GETDATE())
              AND l.created_at <= DATEADD(HOUR, -@hours, l.deadline_at)
        `);
    return result.recordset;
}

/** Prazo dos iniciais vencido nas últimas `hoursBack` horas (só os recentes: nada de avisar prazo antigo). */
export async function assignmentsRecentlyExpired(hoursBack = 24) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('hours_back', sql.Int, hoursBack)
        .query(`
            SELECT ${DEADLINE_COLUMNS}
            ${DEADLINE_JOINS}
            WHERE l.[status] IN (0, 1)
              AND lr.[status] = 5
              AND l.deadline_at <= GETDATE()
              AND l.deadline_at > DATEADD(HOUR, -@hours_back, GETDATE())
        `);
    return result.recordset;
}
