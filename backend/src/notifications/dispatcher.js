import * as deliveryModel from '../models/notificationDeliveryModel.js';
import { DELIVERY_STATUSES } from '../models/notificationDeliveryModel.js';
import { deliverMail } from '../services/mailService.js';
import { renderEvent } from './templates/index.js';

/**
 * Entrega de um evento: um e-mail por destinatário, com registro em notification_deliveries.
 * O mesmo evento (event_id) para o mesmo destinatário nunca é enviado duas vezes: se o Kafka
 * entregar a mensagem de novo (ex.: o notifier reiniciou antes de confirmar), o envio já
 * existe e é ignorado.
 *
 * Falha no envio (Microsoft Graph): tenta de novo com espera crescente; na 5ª falha (ou erro que não se resolve) vai para a
 * fila de erro (status DLQ e tópico notifications.dlq).
 */

export const MAX_ATTEMPTS = 5;

// Espera depois da 1ª, 2ª, 3ª e 4ª falha (padrão 1 min, 5 min, 15 min, 1 h)
function retryDelays() {
    const fromEnv = (process.env.NOTIFIER_RETRY_DELAYS_MS ?? '').split(',').map(Number).filter((n) => Number.isFinite(n) && n > 0);
    return fromEnv.length > 0 ? fromEnv : [60000, 300000, 900000, 3600000];
}

function delayFor(attempt) {
    const delays = retryDelays();
    return delays[Math.min(attempt - 1, delays.length - 1)];
}

/**
 * Tenta enviar um envio já reservado (claim feito: status "enviando", attempts = attempt).
 * @param {{ publishDlq?: (message: object) => Promise<void>, log?: Function }} deps
 */
export async function attemptDelivery(delivery, attempt, event, deps = {}) {
    const log = deps.log ?? console.log;
    // Código de acesso vencido (o login vale 10 min): não adianta mandar
    if (event.data?.expiresAt && Date.now() > new Date(event.data.expiresAt).getTime()) {
        await deliveryModel.markSkipped(delivery.id, null, 'Vencido antes do envio (não enviado).');
        return 'skipped';
    }
    let message;
    try {
        message = renderEvent(event, delivery.recipient);
    } catch (error) {
        // Erro no modelo não se resolve tentando de novo: vai direto para a fila de erro
        await deliveryModel.markDlq(delivery.id, null, `Modelo: ${error.message}`);
        await deps.publishDlq?.({ event, recipient: delivery.recipient, attempts: attempt, error: error.message }).catch(() => {});
        log(`[notifier] ${event.type} → ${delivery.recipient}: sem modelo (${error.message})`);
        return 'dlq';
    }

    const result = await deliverMail({ to: delivery.recipient, subject: message.subject, html: message.html });
    if (result.status === 'sent') {
        await deliveryModel.markSent(delivery.id, message.subject);
        return 'sent';
    }
    if (result.status === 'skipped') {
        await deliveryModel.markSkipped(delivery.id, message.subject, result.error);
        return 'skipped';
    }
    // Erro que não se resolve tentando de novo (ex.: destinatário inválido): direto para a fila de erro
    if (attempt >= MAX_ATTEMPTS || result.permanent) {
        await deliveryModel.markDlq(delivery.id, message.subject, result.error);
        await deps.publishDlq?.({ event, recipient: delivery.recipient, attempts: attempt, error: result.error })
            .catch((error) => log(`[notifier] não publicou na fila de erro: ${error.message}`));
        log(`[notifier] ${event.type} → ${delivery.recipient}: fila de erro depois de ${attempt} tentativas (${result.error})`);
        return 'dlq';
    }
    // Microsoft pediu para esperar (429 / 503): respeita, se for mais que a espera normal
    const wait = Math.max(delayFor(attempt), result.retryAfterMs ?? 0);
    await deliveryModel.markFailed(delivery.id, message.subject, result.error, wait);
    log(`[notifier] ${event.type} → ${delivery.recipient}: falhou (tentativa ${attempt}), tenta de novo depois: ${result.error}`);
    return 'failed';
}

/** Processa um evento que chegou do Kafka. */
export async function processEvent(event, deps = {}) {
    if (!event?.id || !event?.type || !Array.isArray(event.recipients)) return;
    for (const recipient of event.recipients) {
        const delivery = await deliveryModel.ensureDelivery(event.id, event.type, recipient);
        // Já enviado / em envio / esperando nova tentativa: nada a fazer aqui
        if (delivery.status !== DELIVERY_STATUSES.QUEUED) continue;
        const attempt = await deliveryModel.claim(delivery.id, [DELIVERY_STATUSES.QUEUED]);
        if (attempt === null) continue;
        await attemptDelivery(delivery, attempt, event, deps);
    }
}

/** Novas tentativas: envios que falharam e chegou a hora (ou o Admin pediu para reenviar). */
export async function processDueRetries(deps = {}) {
    const due = await deliveryModel.claimDueRetries();
    for (const delivery of due) {
        const event = await deliveryModel.getEventPayload(delivery.event_id);
        if (!event) {
            await deliveryModel.markDlq(delivery.id, null, 'Evento não encontrado na outbox.');
            continue;
        }
        await attemptDelivery(delivery, delivery.attempts, event, deps);
    }
    return due.length;
}
