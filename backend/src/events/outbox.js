import crypto from 'crypto';
import { sql, poolPromise } from '../config/dbConfig.js';
import { eventDefinition } from './catalog.js';
import { isNotificationEnabled } from '../services/settingsService.js';
import { normalizeEmail } from '../utils/email.js';

/**
 * Outbox de eventos: a API grava o evento na MESMA transação da ação (se a ação for desfeita,
 * o evento também some) e responde na hora. O notifier publica no Kafka depois; e-mail
 * nenhum atrasa a API.
 */

const DUPLICATE_KEY_ERRORS = [2601, 2627];

function cleanRecipients(recipients) {
    const list = (Array.isArray(recipients) ? recipients : [recipients])
        .map((email) => normalizeEmail(email ?? ''))
        .filter((email) => email && email.includes('@'));
    return [...new Set(list)];
}

/**
 * Grava um evento na outbox.
 *
 * @param {object|null} transaction — transação da ação (null: grava sozinho, ex.: agendador)
 * @param {{ type: string, recipients: string[], data: object, key?: string, dedupeKey?: string }} event
 * @returns {Promise<string|null>} event_id, ou null se não gravou (sem destinatário, aviso
 *          desligado em Parâmetros ou repetido pela dedupeKey)
 */
export async function enqueueEvent(transaction, { type, recipients, data = {}, key = null, dedupeKey = null }) {
    const definition = eventDefinition(type);
    if (!definition) throw new Error(`Tipo de evento desconhecido: ${type}`);

    const to = cleanRecipients(recipients);
    if (to.length === 0) return null;
    if (!(await isNotificationEnabled(type))) return null;

    const eventId = crypto.randomUUID();
    const payload = JSON.stringify({
        id: eventId,
        type,
        occurredAt: new Date().toISOString(),
        recipients: to,
        data,
    });

    const request = transaction ? new sql.Request(transaction) : (await poolPromise).request();
    try {
        await request
            .input('event_id', sql.UniqueIdentifier, eventId)
            .input('event_type', sql.VarChar(100), type)
            .input('topic', sql.VarChar(100), definition.topic)
            .input('message_key', sql.NVarChar(200), key === null || key === undefined ? null : String(key))
            .input('payload', sql.NVarChar(sql.MAX), payload)
            .input('dedupe_key', sql.NVarChar(300), dedupeKey)
            .query(`
                INSERT INTO event_outbox (event_id, event_type, topic, message_key, payload, dedupe_key)
                SELECT @event_id, @event_type, @topic, @message_key, @payload, @dedupe_key
                WHERE @dedupe_key IS NULL
                   OR NOT EXISTS (SELECT 1 FROM event_outbox WITH (UPDLOCK, HOLDLOCK) WHERE dedupe_key = @dedupe_key)
            `);
    } catch (error) {
        // Dois agendadores ao mesmo tempo: o índice único da dedupe_key segura o segundo
        if (dedupeKey && DUPLICATE_KEY_ERRORS.includes(error.number)) return null;
        throw error;
    }
    return eventId;
}

/** Já existe um evento com esta dedupe_key? (o agendador evita montar o que não vai gravar) */
export async function hasDedupeKey(dedupeKey) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('dedupe_key', sql.NVarChar(300), dedupeKey)
        .query('SELECT 1 AS found FROM event_outbox WHERE dedupe_key = @dedupe_key');
    return result.recordset.length > 0;
}
