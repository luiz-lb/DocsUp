import { Kafka, logLevel, Partitioners } from 'kafkajs';
import { TOPICS } from './catalog.js';

/**
 * Cliente Kafka do notifier. KAFKA_BROKERS: lista separada por vírgula (no Docker,
 * "kafka:9092"). A API não usa o Kafka: ela só grava na outbox.
 */
export function createKafka(clientId = 'docsup-notifier') {
    const brokers = (process.env.KAFKA_BROKERS || 'kafka:9092').split(',').map((broker) => broker.trim()).filter(Boolean);
    return new Kafka({
        clientId,
        brokers,
        logLevel: logLevel.WARN,
        retry: { initialRetryTime: 500, retries: 8 },
    });
}

export function createProducer(kafka) {
    return kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner, allowAutoTopicCreation: false });
}

// 3 partições: dá para ter mais de um notifier consumindo em paralelo no futuro
const PARTITIONS = Number(process.env.KAFKA_TOPIC_PARTITIONS || 3);

/** Cria os tópicos que ainda não existem (idempotente). */
export async function ensureTopics(kafka) {
    const admin = kafka.admin();
    await admin.connect();
    try {
        const existing = new Set(await admin.listTopics());
        const missing = Object.values(TOPICS).filter((topic) => !existing.has(topic));
        if (missing.length > 0) {
            await admin.createTopics({
                waitForLeaders: true,
                topics: missing.map((topic) => ({ topic, numPartitions: PARTITIONS, replicationFactor: 1 })),
            });
        }
        return missing;
    } finally {
        await admin.disconnect();
    }
}
