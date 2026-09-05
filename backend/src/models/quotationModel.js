import { sql, poolPromise } from '../config/dbConfig.js';

// ─────────────────────────────────────────────
// Quotation Rounds
// ─────────────────────────────────────────────

/**
 * Cria uma nova rodada de cotação para uma labor_request.
 * Retorna o ID gerado.
 */
export async function insertQuotationRound(transaction, { laborRequestId, deadline, createdBy }) {
    const request = new sql.Request(transaction);
    const result = await request
        .input('labor_request_id', sql.Int, laborRequestId)
        .input('deadline', sql.DateTime2, deadline)
        .input('created_by', sql.Int, createdBy)
        .query(`
            INSERT INTO quotation_rounds (labor_request_id, round_number, [status], deadline, created_by)
            OUTPUT INSERTED.id
            SELECT
                @labor_request_id,
                ISNULL((SELECT MAX(round_number) FROM quotation_rounds WHERE labor_request_id = @labor_request_id), 0) + 1,
                0,  -- Aberta
                @deadline,
                @created_by
        `);
    return result.recordset[0]?.id ?? null;
}

/**
 * Busca uma rodada completa com suas cotações ordenadas por valor.
 */
export async function getQuotationRoundById(roundId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, roundId)
        .query(`
            SELECT
                r.id,
                r.uid,
                r.labor_request_id,
                r.round_number,
                r.[status],
                r.deadline,
                r.created_by,
                r.created_at,
                lr.title AS labor_request_title
            FROM quotation_rounds AS r
            INNER JOIN labor_requests AS lr ON lr.id = r.labor_request_id
            WHERE r.id = @id
        `);
    return result.recordset[0] ?? null;
}

/**
 * Lista os rounds de uma solicitação.
 */
export async function getRoundsByLaborRequestId(laborRequestId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('labor_request_id', sql.Int, laborRequestId)
        .query(`
            SELECT id, uid, round_number, [status], deadline, created_at
            FROM quotation_rounds
            WHERE labor_request_id = @labor_request_id
            ORDER BY round_number DESC
        `);
    return result.recordset;
}

/**
 * Atualiza o status de uma rodada.
 * status: 0=Aberta, 1=Encerrada, 2=Cancelada
 */
export async function updateRoundStatus(transaction, roundId, status) {
    const request = new sql.Request(transaction);
    const result = await request
        .input('id', sql.Int, roundId)
        .input('status', sql.TinyInt, status)
        .query(`
            UPDATE quotation_rounds
            SET [status] = @status
            WHERE id = @id
        `);
    return result.rowsAffected[0] > 0;
}

// ─────────────────────────────────────────────
// Quotation Invites
// ─────────────────────────────────────────────

/**
 * Cria convites de cotação (um por email/fornecedor).
 * Retorna array de IDs gerados.
 */
export async function insertQuotationInvite(transaction, { roundId, supplierId, inviteEmail, inviteToken }) {
    const request = new sql.Request(transaction);
    const result = await request
        .input('round_id', sql.Int, roundId)
        .input('supplier_id', sql.Int, supplierId ?? null)
        .input('invite_email', sql.NVarChar(200), inviteEmail ?? null)
        .input('invite_token', sql.VarChar(200), inviteToken)
        .query(`
            INSERT INTO quotation_invites (round_id, supplier_id, invite_email, invite_token, [status])
            OUTPUT INSERTED.id
            VALUES (@round_id, @supplier_id, @invite_email, @invite_token, 0)
        `);
    return result.recordset[0]?.id ?? null;
}

/**
 * Busca um convite pelo token único.
 */
export async function getInviteByToken(token) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('token', sql.VarChar(200), token)
        .query(`
            SELECT
                i.id,
                i.uid,
                i.round_id,
                i.supplier_id,
                i.invite_email,
                i.invite_token,
                i.[status],
                i.sent_at,
                i.viewed_at,
                i.responded_at
            FROM quotation_invites AS i
            WHERE i.invite_token = @token
        `);
    return result.recordset[0] ?? null;
}

/**
 * Marca um convite como visualizado (status=1).
 */
export async function markInviteViewed(inviteId) {
    const pool = await poolPromise;
    await pool.request()
        .input('id', sql.Int, inviteId)
        .query(`
            UPDATE quotation_invites
            SET [status] = 1, viewed_at = GETDATE()
            WHERE id = @id AND [status] = 0
        `);
}

/**
 * Marca um convite como respondido (status=2) e vincula o fornecedor.
 * Quando o convite foi criado só com email, o supplier_id fica NULL até
 * a resposta — aqui garantimos o vínculo para consultas futuras.
 */
export async function markInviteResponded(transaction, inviteId, supplierId = null) {
    const request = new sql.Request(transaction);
    await request
        .input('id', sql.Int, inviteId)
        .input('supplier_id', sql.Int, supplierId)
        .query(`
            UPDATE quotation_invites
            SET [status] = 2,
                responded_at = GETDATE(),
                supplier_id = COALESCE(supplier_id, @supplier_id)
            WHERE id = @id
        `);
}

// ─────────────────────────────────────────────
// Quotations
// ─────────────────────────────────────────────

/**
 * Insere uma nova cotação. Retorna o ID gerado.
 */
export async function insertQuotation(transaction, {
    roundId, supplierId, inviteId,
    totalValue, currency, notes,
    checklistAccepted, omissionWarningAccepted,
    acceptanceIp, acceptanceUserAgent,
}) {
    const request = new sql.Request(transaction);
    const result = await request
        .input('round_id', sql.Int, roundId)
        .input('supplier_id', sql.Int, supplierId)
        .input('invite_id', sql.Int, inviteId ?? null)
        .input('total_value', sql.Decimal(15, 2), totalValue)
        .input('currency', sql.VarChar(3), currency ?? 'BRL')
        .input('notes', sql.NVarChar(sql.MAX), notes ?? null)
        .input('checklist_accepted', sql.Bit, checklistAccepted ? 1 : 0)
        .input('omission_warning_accepted', sql.Bit, omissionWarningAccepted ? 1 : 0)
        .input('acceptance_ip', sql.VarChar(45), acceptanceIp ?? null)
        .input('acceptance_user_agent', sql.NVarChar(sql.MAX), acceptanceUserAgent ?? null)
        .query(`
            INSERT INTO quotations
                (round_id, supplier_id, invite_id, total_value, currency, notes,
                 checklist_accepted, omission_warning_accepted,
                 acceptance_ip, acceptance_at, acceptance_user_agent,
                 [status], submitted_at)
            OUTPUT INSERTED.id
            VALUES
                (@round_id, @supplier_id, @invite_id, @total_value, @currency, @notes,
                 @checklist_accepted, @omission_warning_accepted,
                 @acceptance_ip, GETDATE(), @acceptance_user_agent,
                 1,  -- Submetida
                 GETDATE())
        `);
    return result.recordset[0]?.id ?? null;
}

/**
 * Insere a declaração de NRs de uma cotação.
 */
export async function insertNrDeclaration(transaction, quotationId, nrTypeId, employeeCount) {
    const request = new sql.Request(transaction);
    await request
        .input('quotation_id', sql.Int, quotationId)
        .input('nr_type_id', sql.Int, nrTypeId)
        .input('employee_count', sql.Int, employeeCount)
        .query(`
            IF NOT EXISTS (
                SELECT 1 FROM quotation_nr_declarations
                WHERE quotation_id = @quotation_id AND nr_type_id = @nr_type_id
            )
            INSERT INTO quotation_nr_declarations (quotation_id, nr_type_id, employee_count)
            VALUES (@quotation_id, @nr_type_id, @employee_count)
        `);
}

/**
 * Insere um item do checklist da empresa na cotação.
 */
export async function insertCompanyChecklist(transaction, quotationId, documentTypeId, hasDocument) {
    const request = new sql.Request(transaction);
    await request
        .input('quotation_id', sql.Int, quotationId)
        .input('document_type_id', sql.Int, documentTypeId)
        .input('has_document', sql.Bit, hasDocument ? 1 : 0)
        .query(`
            IF NOT EXISTS (
                SELECT 1 FROM quotation_company_checklist
                WHERE quotation_id = @quotation_id AND document_type_id = @document_type_id
            )
            INSERT INTO quotation_company_checklist (quotation_id, document_type_id, has_document)
            VALUES (@quotation_id, @document_type_id, @has_document)
        `);
}

/**
 * Lista as cotações de uma rodada, ordenadas por valor crescente.
 */
export async function getQuotationsByRoundId(roundId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('round_id', sql.Int, roundId)
        .query(`
            SELECT
                q.id,
                q.uid,
                q.round_id,
                q.supplier_id,
                s.razao_social AS supplier_name,
                s.nome_fantasia,
                q.total_value,
                q.currency,
                q.notes,
                q.checklist_accepted,
                q.omission_warning_accepted,
                q.acceptance_ip,
                q.acceptance_at,
                q.[status],
                q.ranking,
                q.submitted_at
            FROM quotations AS q
            INNER JOIN suppliers AS s ON s.id = q.supplier_id
            WHERE q.round_id = @round_id
            ORDER BY q.total_value ASC
        `);
    return result.recordset;
}

/**
 * Lista todos os CONVITES de uma rodada com o status do convite e,
 * quando o fornecedor já enviou, os dados da cotação.
 *
 * Regras:
 *  - Sempre retorna uma linha por convite (quotation_invites).
 *  - Se a cotação existir (quotations), seus dados aparecem nas colunas q_*.
 *  - Ordenação: cotações com valor ASC no topo, depois convites sem resposta.
 *
 * Colunas do invite (prefixo i_):
 *   i_id, i_uid, i_invite_email, i_status,
 *   i_sent_at, i_viewed_at, i_responded_at
 *
 * Colunas da cotação (prefixo q_, nullable):
 *   q_id, q_total_value, q_currency, q_status,
 *   q_ranking, q_submitted_at, q_acceptance_ip, q_acceptance_at
 *
 * Colunas do fornecedor (quando vinculado ao convite ou à cotação):
 *   supplier_name, nome_fantasia
 */
export async function getInvitesWithQuotationsByRoundId(roundId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('round_id', sql.Int, roundId)
        .query(`
            SELECT
                -- Convite
                i.id            AS i_id,
                i.uid           AS i_uid,
                i.invite_email  AS i_invite_email,
                i.[status]      AS i_status,
                i.sent_at       AS i_sent_at,
                i.viewed_at     AS i_viewed_at,
                i.responded_at  AS i_responded_at,

                -- Fornecedor (vem do invite ou da cotação)
                COALESCE(si.razao_social, sq.razao_social) AS supplier_name,
                COALESCE(si.nome_fantasia, sq.nome_fantasia) AS nome_fantasia,

                -- Cotação (NULL se ainda não respondeu)
                q.id            AS q_id,
                q.total_value   AS q_total_value,
                q.currency      AS q_currency,
                q.[status]      AS q_status,
                q.ranking       AS q_ranking,
                q.submitted_at  AS q_submitted_at,
                q.acceptance_ip AS q_acceptance_ip,
                q.acceptance_at AS q_acceptance_at

            FROM quotation_invites AS i

            -- Cotação vinculada ao convite (LEFT: pode não ter respondido)
            LEFT JOIN quotations AS q
                ON q.invite_id = i.id

            -- Fornecedor do convite (quando supplierId já estava no convite)
            LEFT JOIN suppliers AS si
                ON si.id = i.supplier_id

            -- Fornecedor da cotação (quando o fornecedor se identificou ao cotar)
            LEFT JOIN suppliers AS sq
                ON sq.id = q.supplier_id

            WHERE i.round_id = @round_id

            ORDER BY
                -- Cotações enviadas primeiro, ranqueadas pelo valor
                CASE WHEN q.id IS NOT NULL THEN 0 ELSE 1 END ASC,
                q.total_value ASC,
                i.sent_at ASC
        `);
    return result.recordset;
}

/**
 * Busca uma cotação pelo ID com detalhes de NR e checklist.
 */
export async function getQuotationById(quotationId) {
    const pool = await poolPromise;

    const quotResult = await pool.request()
        .input('id', sql.Int, quotationId)
        .query(`
            SELECT
                q.id, q.uid, q.round_id, q.supplier_id,
                s.razao_social AS supplier_name,
                q.total_value, q.currency, q.notes,
                q.checklist_accepted, q.omission_warning_accepted,
                q.acceptance_ip, q.acceptance_at, q.acceptance_user_agent,
                q.[status], q.ranking, q.submitted_at
            FROM quotations AS q
            INNER JOIN suppliers AS s ON s.id = q.supplier_id
            WHERE q.id = @id
        `);

    const quotation = quotResult.recordset[0];
    if (!quotation) return null;

    const nrResult = await pool.request()
        .input('quotation_id', sql.Int, quotationId)
        .query('SELECT nr_type_id, employee_count FROM quotation_nr_declarations WHERE quotation_id = @quotation_id');

    const checklistResult = await pool.request()
        .input('quotation_id', sql.Int, quotationId)
        .query('SELECT document_type_id, has_document FROM quotation_company_checklist WHERE quotation_id = @quotation_id');

    return {
        ...quotation,
        nrDeclarations: nrResult.recordset,
        checklist: checklistResult.recordset,
    };
}

/**
 * Atualiza o status de uma cotação.
 * status: 1=Submetida, 2=Vencedora, 3=Perdedora, 4=Desclassificada, 5=Desclassificada por Doc
 */
export async function updateQuotationStatus(transaction, quotationId, status) {
    const request = new sql.Request(transaction);
    const result = await request
        .input('id', sql.Int, quotationId)
        .input('status', sql.TinyInt, status)
        .query('UPDATE quotations SET [status] = @status WHERE id = @id');
    return result.rowsAffected[0] > 0;
}

/**
 * Atualiza o ranking de uma cotação (posição no round).
 */
export async function updateQuotationRanking(transaction, quotationId, ranking) {
    const request = new sql.Request(transaction);
    await request
        .input('id', sql.Int, quotationId)
        .input('ranking', sql.Int, ranking)
        .query('UPDATE quotations SET ranking = @ranking WHERE id = @id');
}

// ─────────────────────────────────────────────
// Phase 2 Deadlines
// ─────────────────────────────────────────────

/**
 * Cria o prazo de Fase 2 para o fornecedor vencedor.
 * Retorna o registro criado com o link_token.
 */
export async function insertPhase2Deadline(transaction, {
    quotationId, supplierId, laborRequestId, linkToken, deadlineHours
}) {
    const request = new sql.Request(transaction);
    const result = await request
        .input('quotation_id', sql.Int, quotationId)
        .input('supplier_id', sql.Int, supplierId)
        .input('labor_request_id', sql.Int, laborRequestId)
        .input('link_token', sql.VarChar(200), linkToken)
        .input('deadline_hours', sql.Int, deadlineHours)
        .query(`
            INSERT INTO phase2_deadlines
                (quotation_id, supplier_id, labor_request_id, link_token, deadline_hours, started_at, expires_at, [status])
            OUTPUT INSERTED.id, INSERTED.uid, INSERTED.link_token, INSERTED.expires_at
            VALUES
                (@quotation_id, @supplier_id, @labor_request_id, @link_token, @deadline_hours,
                 GETDATE(),
                 DATEADD(HOUR, @deadline_hours, GETDATE()),
                 0)  -- Pendente
        `);
    return result.recordset[0] ?? null;
}

/**
 * Busca deadlines de Fase 2 vencidos e ainda pendentes (para job de penalidade).
 */
export async function getExpiredPhase2Deadlines() {
    const pool = await poolPromise;
    const result = await pool.request()
        .query(`
            SELECT id, quotation_id, supplier_id, labor_request_id, link_token, expires_at
            FROM phase2_deadlines
            WHERE [status] = 0 AND expires_at < GETDATE()
        `);
    return result.recordset;
}

/**
 * Atualiza o status do phase2_deadline.
 * status: 0=Pendente, 1=Concluído, 2=Expirado
 */
export async function updatePhase2DeadlineStatus(transaction, deadlineId, status, completedAt) {
    const request = new sql.Request(transaction);
    await request
        .input('id', sql.Int, deadlineId)
        .input('status', sql.TinyInt, status)
        .input('completed_at', sql.DateTime2, completedAt ?? null)
        .query(`
            UPDATE phase2_deadlines
            SET [status] = @status,
                completed_at = @completed_at
            WHERE id = @id
        `);
}

/**
 * Lista as cotações e convites de um fornecedor (portal do fornecedor).
 *
 * Um convite pode ter sido criado de 3 formas:
 *   1. Já vinculado ao supplier_id (quando Suprimentos escolhe um fornecedor existente).
 *   2. Apenas com o invite_email (quando Suprimentos convida por email — caso mais comum).
 *   3. Vinculado depois, quando o fornecedor responde (q.supplier_id).
 *
 * Para o caso 2, casamos o invite_email com QUALQUER email de contato
 * (legal/operacional) cadastrado do fornecedor — assim o convite aparece no
 * portal mesmo que tenha sido enviado ao email do dono OU do operador.
 *
 * Ordenado por data de envio do convite DESC.
 */
export async function getQuotationsBySupplierId(supplierId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('supplier_id', sql.Int, supplierId)
        .query(`
            SELECT
                i.id            AS i_id,
                i.invite_token  AS i_invite_token,
                i.invite_email  AS i_invite_email,
                i.[status]      AS i_status,
                i.sent_at       AS i_sent_at,
                i.responded_at  AS i_responded_at,

                r.id            AS round_id,
                r.deadline      AS round_deadline,
                r.[status]      AS round_status,

                lr.id           AS labor_request_id,
                lr.title        AS labor_request_title,
                lr.[location]   AS labor_request_location,

                q.id            AS q_id,
                q.total_value   AS q_total_value,
                q.[status]      AS q_status,
                q.submitted_at  AS q_submitted_at,
                q.acceptance_at AS q_acceptance_at

            FROM quotation_invites AS i
            INNER JOIN quotation_rounds AS r
                ON r.id = i.round_id
            INNER JOIN labor_requests AS lr
                ON lr.id = r.labor_request_id
            LEFT JOIN quotations AS q
                ON q.invite_id = i.id

            WHERE
                -- 1. convite já vinculado ao fornecedor
                i.supplier_id = @supplier_id
                -- 3. fornecedor respondeu (cotação vinculada)
                OR q.supplier_id = @supplier_id
                -- 2. convite por email: casa com email de contato do fornecedor
                OR EXISTS (
                    SELECT 1
                    FROM supplier_contacts AS sc
                    WHERE sc.supplier_id = @supplier_id
                      AND LOWER(sc.email) = LOWER(i.invite_email)
                )

            ORDER BY i.sent_at DESC
        `);
    return result.recordset;
}

/**
 * Busca um phase2_deadline pelo link_token.
 */
export async function getPhase2DeadlineByToken(token) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('token', sql.VarChar(200), token)
        .query(`
            SELECT
                p.id, p.uid, p.quotation_id, p.supplier_id, p.labor_request_id,
                p.link_token, p.deadline_hours, p.started_at, p.expires_at,
                p.[status], p.completed_at,
                s.razao_social AS supplier_name,
                lr.title AS labor_request_title
            FROM phase2_deadlines AS p
            INNER JOIN suppliers AS s ON s.id = p.supplier_id
            INNER JOIN labor_requests AS lr ON lr.id = p.labor_request_id
            WHERE p.link_token = @token
        `);
    return result.recordset[0] ?? null;
}
