// Envios das notificações: um por evento e destinatário (UNIQUE event_id + recipient)
import { sql, poolPromise } from '../config/dbConfig.js';

export const DELIVERY_STATUSES = Object.freeze({
    QUEUED: 0,   // na fila
    SENDING: 1,  // enviando agora
    SENT: 2,     // enviado
    FAILED: 3,   // falhou: vai tentar de novo (next_attempt_at)
    DLQ: 4,      // fila de erro: falhou 5 vezes
    SKIPPED: 5,  // não enviado: envio de e-mail desligado no servidor
});

const DELIVERY_COLUMNS = `
    id, event_id, event_type, recipient, subject, [status], attempts, next_attempt_at,
    claimed_at, last_error, created_at, sent_at, updated_at
`;

/** Cria o envio (se ainda não existe) e devolve a linha. */
export async function ensureDelivery(eventId, eventType, recipient) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('event_id', sql.UniqueIdentifier, eventId)
        .input('event_type', sql.VarChar(100), eventType)
        .input('recipient', sql.NVarChar(200), recipient)
        .query(`
            IF NOT EXISTS (SELECT 1 FROM notification_deliveries WITH (UPDLOCK, HOLDLOCK)
                           WHERE event_id = @event_id AND recipient = @recipient)
                INSERT INTO notification_deliveries (event_id, event_type, recipient)
                VALUES (@event_id, @event_type, @recipient);
            SELECT ${DELIVERY_COLUMNS} FROM notification_deliveries
            WHERE event_id = @event_id AND recipient = @recipient;
        `);
    return result.recordset[0];
}

/**
 * Reserva o envio para tentar agora (status → enviando, +1 tentativa), só se ele estiver num
 * dos status esperados. Retorna o nº da tentativa, ou null se outro já pegou.
 */
export async function claim(id, fromStatuses) {
    const pool = await poolPromise;
    const request = pool.request().input('id', sql.BigInt, id);
    const params = fromStatuses.map((status, index) => {
        request.input(`s${index}`, sql.TinyInt, status);
        return `@s${index}`;
    });
    const result = await request.query(`
        UPDATE notification_deliveries
        SET [status] = ${DELIVERY_STATUSES.SENDING},
            attempts = attempts + 1,
            claimed_at = SYSDATETIME(),
            updated_at = SYSDATETIME()
        OUTPUT inserted.attempts
        WHERE id = @id AND [status] IN (${params.join(', ')})
    `);
    return result.recordset[0]?.attempts ?? null;
}

async function finish(id, status, { subject = null, error = null, nextAttemptMs = null, sent = false } = {}) {
    const pool = await poolPromise;
    await pool.request()
        .input('id', sql.BigInt, id)
        .input('status', sql.TinyInt, status)
        .input('subject', sql.NVarChar(300), subject ? String(subject).slice(0, 300) : null)
        .input('error', sql.NVarChar(1000), error ? String(error).slice(0, 1000) : null)
        .input('next_ms', sql.Int, nextAttemptMs)
        .input('sent', sql.Bit, sent ? 1 : 0)
        .query(`
            UPDATE notification_deliveries
            SET [status] = @status,
                subject = COALESCE(@subject, subject),
                last_error = @error,
                next_attempt_at = CASE WHEN @next_ms IS NULL THEN NULL ELSE DATEADD(MILLISECOND, @next_ms, SYSDATETIME()) END,
                sent_at = CASE WHEN @sent = 1 THEN SYSDATETIME() ELSE sent_at END,
                claimed_at = NULL,
                updated_at = SYSDATETIME()
            WHERE id = @id
        `);
}

export const markSent = (id, subject) => finish(id, DELIVERY_STATUSES.SENT, { subject, sent: true });
export const markSkipped = (id, subject, reason) => finish(id, DELIVERY_STATUSES.SKIPPED, { subject, error: reason });
export const markFailed = (id, subject, error, nextAttemptMs) => finish(id, DELIVERY_STATUSES.FAILED, { subject, error, nextAttemptMs });
export const markDlq = (id, subject, error) => finish(id, DELIVERY_STATUSES.DLQ, { subject, error });

/**
 * Envios para tentar de novo agora: falharam e chegou a hora, ou ficaram "enviando" por
 * mais de stuckMinutes (o notifier caiu no meio do envio).
 */
export async function claimDueRetries(limit = 20, stuckMinutes = 10) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('limit', sql.Int, limit)
        .input('stuck', sql.Int, stuckMinutes)
        .query(`
            WITH due AS (
                SELECT TOP (@limit) *
                FROM notification_deliveries WITH (ROWLOCK, READPAST, UPDLOCK)
                WHERE ([status] = ${DELIVERY_STATUSES.FAILED} AND next_attempt_at <= SYSDATETIME())
                   OR ([status] = ${DELIVERY_STATUSES.SENDING} AND claimed_at < DATEADD(MINUTE, -@stuck, SYSDATETIME()))
                ORDER BY id
            )
            UPDATE due
            SET [status] = ${DELIVERY_STATUSES.SENDING},
                attempts = attempts + 1,
                claimed_at = SYSDATETIME(),
                updated_at = SYSDATETIME()
            OUTPUT inserted.id, inserted.event_id, inserted.event_type, inserted.recipient, inserted.attempts
        `);
    return result.recordset;
}

/** Payload do evento (para reenviar). */
export async function getEventPayload(eventId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('event_id', sql.UniqueIdentifier, eventId)
        .query('SELECT payload FROM event_outbox WHERE event_id = @event_id');
    const raw = result.recordset[0]?.payload;
    return raw ? JSON.parse(raw) : null;
}

/** Últimos envios (Parâmetros → Notificações), com filtro de status. */
export async function listDeliveries({ status = null, limit = 50, offset = 0 } = {}) {
    const pool = await poolPromise;
    const request = pool.request()
        .input('limit', sql.Int, limit)
        .input('offset', sql.Int, offset);
    let where = '';
    if (Array.isArray(status) && status.length > 0) {
        const params = status.map((value, index) => {
            request.input(`st${index}`, sql.TinyInt, value);
            return `@st${index}`;
        });
        where = `WHERE [status] IN (${params.join(', ')})`;
    }
    const result = await request.query(`
        SELECT ${DELIVERY_COLUMNS}, COUNT(*) OVER () AS total
        FROM notification_deliveries
        ${where}
        ORDER BY created_at DESC, id DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
    return {
        rows: result.recordset.map(({ total, ...row }) => row),
        total: result.recordset[0]?.total ?? 0,
    };
}

/** Totais por status (cards da tela). */
export async function countByStatus() {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT [status], COUNT(*) AS total FROM notification_deliveries GROUP BY [status]');
    return Object.fromEntries(result.recordset.map((row) => [row.status, row.total]));
}

/**
 * Admin pede para reenviar: volta para "falhou" com as tentativas zeradas e hora = agora (o
 * notifier pega no próximo ciclo). Só de falhou / fila de erro / não enviado.
 */
export async function resetForRetry(id, transaction = null) {
    const request = transaction ? new sql.Request(transaction) : (await poolPromise).request();
    const result = await request
        .input('id', sql.BigInt, id)
        .query(`
            UPDATE notification_deliveries
            SET [status] = ${DELIVERY_STATUSES.FAILED},
                attempts = 0,
                next_attempt_at = SYSDATETIME(),
                updated_at = SYSDATETIME()
            WHERE id = @id
              AND [status] IN (${DELIVERY_STATUSES.FAILED}, ${DELIVERY_STATUSES.DLQ}, ${DELIVERY_STATUSES.SKIPPED})
        `);
    return result.rowsAffected[0] > 0;
}
