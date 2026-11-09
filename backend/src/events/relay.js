import { sql, poolPromise } from '../config/dbConfig.js';
import { createProducer } from './kafka.js';

/**
 * Relay da outbox: lê os eventos ainda não publicados (em lotes, do mais antigo para o mais
 * novo), publica no Kafka e marca como publicados. Se o Kafka estiver fora do ar, os eventos
 * ficam na outbox e voltam a ser tentados com espera crescente: nada se perde.
 *
 * Seguro com mais de um notifier: cada lote é "reservado" (claimed_until) com READPAST.
 */

const BATCH_SIZE = 100;
const CLAIM_SECONDS = 60;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

function backoffMs(attempts) {
    return Math.min(2000 * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
}

async function claimBatch() {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('batch', sql.Int, BATCH_SIZE)
        .input('claim_seconds', sql.Int, CLAIM_SECONDS)
        .query(`
            WITH next_events AS (
                SELECT TOP (@batch) *
                FROM event_outbox WITH (ROWLOCK, READPAST, UPDLOCK)
                WHERE published_at IS NULL
                  AND (next_attempt_at IS NULL OR next_attempt_at <= SYSDATETIME())
                  AND (claimed_until IS NULL OR claimed_until < SYSDATETIME())
                ORDER BY id
            )
            UPDATE next_events
            SET claimed_until = DATEADD(SECOND, @claim_seconds, SYSDATETIME())
            OUTPUT inserted.id, inserted.event_id, inserted.event_type, inserted.topic,
                   inserted.message_key, inserted.payload, inserted.publish_attempts
        `);
    return result.recordset.sort((a, b) => Number(a.id) - Number(b.id));
}

async function markPublished(ids) {
    const pool = await poolPromise;
    const request = pool.request();
    const params = ids.map((id, index) => {
        request.input(`id${index}`, sql.BigInt, id);
        return `@id${index}`;
    });
    await request.query(`
        UPDATE event_outbox
        SET published_at = SYSDATETIME(), claimed_until = NULL, last_error = NULL
        WHERE id IN (${params.join(', ')})
    `);
}

async function markFailed(rows, error) {
    const pool = await poolPromise;
    for (const row of rows) {
        const attempts = row.publish_attempts + 1;
        await pool.request()
            .input('id', sql.BigInt, row.id)
            .input('attempts', sql.Int, attempts)
            .input('wait_ms', sql.Int, backoffMs(attempts))
            .input('error', sql.NVarChar(1000), String(error?.message ?? error).slice(0, 1000))
            .query(`
                UPDATE event_outbox
                SET publish_attempts = @attempts,
                    next_attempt_at = DATEADD(MILLISECOND, @wait_ms, SYSDATETIME()),
                    claimed_until = NULL,
                    last_error = @error
                WHERE id = @id
            `);
    }
}

/**
 * Inicia o relay. Retorna { stop } (para o desligamento do notifier).
 *
 * @param {import('kafkajs').Kafka} kafka
 * @param {{ intervalMs?: number, log?: (msg: string) => void }} options
 */
export function startRelay(kafka, { intervalMs = 1000, log = console.log } = {}) {
    const producer = createProducer(kafka);
    let connected = false;
    let stopped = false;
    let timer = null;
    let running = null;

    async function ensureConnected() {
        if (connected) return;
        await producer.connect();
        connected = true;
        log('[relay] conectado ao Kafka');
    }

    async function publishBatch(rows) {
        const byTopic = new Map();
        for (const row of rows) {
            if (!byTopic.has(row.topic)) byTopic.set(row.topic, []);
            byTopic.get(row.topic).push({
                key: row.message_key ?? null,
                value: row.payload,
                headers: { 'event-type': row.event_type, 'event-id': String(row.event_id).toLowerCase() },
            });
        }
        await producer.sendBatch({
            acks: -1,
            topicMessages: [...byTopic].map(([topic, messages]) => ({ topic, messages })),
        });
    }

    async function tick() {
        if (stopped) return;
        let rows = [];
        try {
            // Lotes seguidos enquanto houver evento esperando
            for (;;) {
                rows = await claimBatch();
                if (rows.length === 0) break;
                await ensureConnected();
                await publishBatch(rows);
                await markPublished(rows.map((row) => row.id));
                if (rows.length < BATCH_SIZE || stopped) break;
            }
        } catch (error) {
            if (rows.length > 0) {
                connected = false;
                try { await producer.disconnect(); } catch { /* já caiu */ }
                await markFailed(rows, error).catch((dbError) => log(`[relay] erro ao registrar falha: ${dbError.message}`));
                log(`[relay] ${rows.length} evento(s) não publicado(s) (vão ser tentados de novo): ${error.message}`);
            } else {
                log(`[relay] erro ao ler a outbox: ${error.message}`);
            }
        }
    }

    function schedule() {
        if (stopped) return;
        timer = setTimeout(async () => {
            running = tick();
            await running;
            running = null;
            schedule();
        }, intervalMs);
    }
    schedule();

    return {
        async stop() {
            stopped = true;
            clearTimeout(timer);
            if (running) await running;
            if (connected) await producer.disconnect().catch(() => {});
        },
        /** Publica agora (sem esperar o próximo ciclo): usado nos testes. */
        flush: () => tick(),
    };
}
