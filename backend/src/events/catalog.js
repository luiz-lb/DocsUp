/**
 * Catálogo dos eventos de notificação. Cada tipo diz em que tópico do Kafka ele vai (o do
 * fornecedor sai na hora, sem esperar os internos) e aparece em Parâmetros → Notificações
 * para ligar / desligar.
 */

export const TOPICS = Object.freeze({
    SUPPLIER: 'notifications.supplier', // avisos ao fornecedor (na hora)
    INTERNAL: 'notifications.internal', // Compras e RH
    DLQ: 'notifications.dlq',           // fila de erro: envios que falharam 5 vezes
});

export const AUDIENCES = Object.freeze({
    SUPPLIER: 'supplier',
    PURCHASING: 'purchasing',
    RH: 'rh',
});

export const EVENT_TYPES = Object.freeze({
    SUPPLIER_INVITED: 'supplier.invited',
    PURCHASING_CONTRACT_BLOCKED: 'purchasing.contract_blocked',
});

/**
 * Definição de cada tipo: tópico, público e textos da tela de Parâmetros.
 * scheduled: disparado pelo agendador (data / hora), não por uma ação.
 */
export const EVENT_DEFINITIONS = Object.freeze({
    [EVENT_TYPES.SUPPLIER_INVITED]: {
        topic: TOPICS.SUPPLIER,
        audience: AUDIENCES.SUPPLIER,
        label: 'Indicação do fornecedor',
        description: 'Convite com o link do contrato quando Compras indica, reenvia ou troca o fornecedor.',
    },
    [EVENT_TYPES.PURCHASING_CONTRACT_BLOCKED]: {
        topic: TOPICS.INTERNAL,
        audience: AUDIENCES.PURCHASING,
        label: 'Fornecedor sem documento da empresa',
        description: 'Aviso a Compras quando o fornecedor declara que não tem um documento da empresa (solicitação bloqueada).',
    },
});

export function eventDefinition(type) {
    return EVENT_DEFINITIONS[type] ?? null;
}

export const EVENT_TYPE_LIST = Object.keys(EVENT_DEFINITIONS);
