import { TOPICS } from './catalog.js';

/**
 * Consumidores do notifier: um grupo por tópico (fornecedor e interno), para um resumo grande
 * do RH nunca atrasar o aviso de um fornecedor. O offset só é confirmado depois que o evento
 * foi processado; se o notifier cair no meio, a mensagem volta e o registro de envios evita
 * e-mail repetido.
 */
const LANES = [
    { name: 'supplier', topic: TOPICS.SUPPLIER },
    { name: 'internal', topic: TOPICS.INTERNAL },
];

/**
 * @param {import('kafkajs').Kafka} kafka
 * @param {{ onEvent: (event: object) => Promise<void>, log?: Function }} options
 */
export async function startConsumers(kafka, { onEvent, log = console.log }) {
    const consumers = [];
    for (const lane of LANES) {
        const consumer = kafka.consumer({
            groupId: `docsup-notifier-${lane.name}`,
            sessionTimeout: 30000,
            heartbeatInterval: 3000,
            allowAutoTopicCreation: false,
        });
        await consumer.connect();
        await consumer.subscribe({ topic: lane.topic, fromBeginning: true });
        await consumer.run({
            partitionsConsumedConcurrently: 3,
            eachMessage: async ({ message, partition }) => {
                let event;
                try {
                    event = JSON.parse(message.value.toString('utf8'));
                } catch {
                    log(`[consumer:${lane.name}] mensagem inválida descartada (partição ${partition}, offset ${message.offset})`);
                    return;
                }
                // Erro aqui (ex.: banco fora do ar) faz o kafkajs tentar a mesma mensagem de novo
                await onEvent(event);
            },
        });
        consumers.push(consumer);
        log(`[consumer:${lane.name}] ouvindo ${lane.topic}`);
    }
    return {
        async stop() {
            for (const consumer of consumers) await consumer.disconnect().catch(() => {});
        },
    };
}
