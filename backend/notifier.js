import 'dotenv/config';
import { createKafka, createProducer, ensureTopics } from './src/events/kafka.js';
import { TOPICS } from './src/events/catalog.js';
import { startRelay } from './src/events/relay.js';
import { startConsumers } from './src/events/consumer.js';
import { processEvent, processDueRetries } from './src/notifications/dispatcher.js';
import { startScheduler } from './src/notifications/scheduler.js';
import './src/notifications/jobs/index.js';
import { isMailEnabled } from './src/services/mailService.js';

/**
 * Serviço de notificações (container próprio, mesmo código do backend):
 *  1. relay: publica no Kafka os eventos que a API gravou na outbox;
 *  2. consumidores: leem os tópicos e enviam os e-mails (um por destinatário, sem repetir);
 *  3. novas tentativas: reenviam o que falhou (espera crescente; na 5ª falha, fila de erro);
 *  4. agendador: prazos, calendário dos mensais e resumo do RH.
 *
 * Se o Kafka estiver fora do ar, os eventos esperam na outbox e o notifier continua tentando.
 */

const log = (message) => console.log(`${new Date().toISOString()} ${message}`);
const RELAY_INTERVAL_MS = Number(process.env.NOTIFIER_RELAY_INTERVAL_MS || 1000);
const RETRY_INTERVAL_MS = Number(process.env.NOTIFIER_RETRY_INTERVAL_MS || 15000);
const SCHEDULER_INTERVAL_MS = Number(process.env.NOTIFIER_SCHEDULER_INTERVAL_MS || 60000);

const kafka = createKafka();
const dlqProducer = createProducer(kafka);
let dlqConnected = false;

async function publishDlq(message) {
    if (!dlqConnected) {
        await dlqProducer.connect();
        dlqConnected = true;
    }
    await dlqProducer.send({
        topic: TOPICS.DLQ,
        messages: [{ key: message.event?.id ?? null, value: JSON.stringify({ ...message, failedAt: new Date().toISOString() }) }],
    });
}

const deps = { publishDlq, log };
const stoppers = [];
let shuttingDown = false;

async function waitForKafka() {
    for (let attempt = 1; !shuttingDown; attempt += 1) {
        try {
            const created = await ensureTopics(kafka);
            if (created.length > 0) log(`[notifier] tópicos criados: ${created.join(', ')}`);
            return;
        } catch (error) {
            const wait = Math.min(2000 * attempt, 30000);
            log(`[notifier] Kafka indisponível (${error.message}); nova tentativa em ${wait / 1000}s`);
            await new Promise((resolve) => setTimeout(resolve, wait));
        }
    }
}

function startRetryLoop() {
    let stopped = false;
    let timer = null;
    let running = null;
    const tick = async () => {
        running = processDueRetries(deps).catch((error) => log(`[retry] erro: ${error.message}`));
        await running;
        running = null;
        if (!stopped) timer = setTimeout(tick, RETRY_INTERVAL_MS);
    };
    timer = setTimeout(tick, RETRY_INTERVAL_MS);
    return {
        async stop() {
            stopped = true;
            clearTimeout(timer);
            if (running) await running;
        },
    };
}

async function main() {
    log(`[notifier] iniciando (e-mail ${isMailEnabled() ? 'LIGADO' : 'DESLIGADO: os envios ficam como "não enviado"'}${process.env.MAIL_REDIRECT_TO ? `, redirecionado para ${process.env.MAIL_REDIRECT_TO}` : ''})`);

    // O relay já começa: se o Kafka ainda não subiu, ele espera e tenta de novo sozinho
    stoppers.push(startRelay(kafka, { intervalMs: RELAY_INTERVAL_MS, log }));
    stoppers.push(startRetryLoop());
    stoppers.push(startScheduler({ intervalMs: SCHEDULER_INTERVAL_MS, log }));

    await waitForKafka();
    if (shuttingDown) return;
    stoppers.push(await startConsumers(kafka, { onEvent: (event) => processEvent(event, deps), log }));
    log('[notifier] pronto');
}

async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`[notifier] ${signal}: encerrando...`);
    for (const stopper of stoppers.reverse()) {
        await stopper.stop().catch((error) => log(`[notifier] erro ao encerrar: ${error.message}`));
    }
    if (dlqConnected) await dlqProducer.disconnect().catch(() => {});
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((error) => {
    log(`[notifier] erro fatal: ${error.stack ?? error.message}`);
    process.exit(1);
});
