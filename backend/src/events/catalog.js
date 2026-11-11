/**
 * Catálogo dos eventos de notificação. Cada tipo diz em que tópico do Kafka ele vai (o do
 * fornecedor sai na hora, sem esperar os internos) e aparece em Parâmetros → Notificações
 * para ligar / desligar.
 */

export const TOPICS = Object.freeze({
    SECURITY: 'notifications.security', // código de acesso do login (retenção de 1 hora)
    SUPPLIER: 'notifications.supplier', // avisos ao fornecedor (na hora)
    INTERNAL: 'notifications.internal', // Compras e RH
    DLQ: 'notifications.dlq',           // fila de erro: envios que falharam 5 vezes
});

// Configuração de cada tópico ao ser criado (o de segurança guarda as mensagens só 1 hora)
export const TOPIC_CONFIGS = Object.freeze({
    [TOPICS.SECURITY]: [{ name: 'retention.ms', value: String(60 * 60 * 1000) }],
});

export const AUDIENCES = Object.freeze({
    SUPPLIER: 'supplier',
    PURCHASING: 'purchasing',
    RH: 'rh',
});

export const EVENT_TYPES = Object.freeze({
    // Código de acesso do login (criptografado no evento)
    SUPPLIER_ACCESS_CODE: 'supplier.access_code',
    // Fornecedor (na hora)
    SUPPLIER_INVITED: 'supplier.invited',
    SUPPLIER_DEADLINE_CHANGED: 'supplier.deadline_changed',
    SUPPLIER_ACCESS_REMOVED: 'supplier.access_removed',
    SUPPLIER_DOCUMENT_RETURNED: 'supplier.document_returned',
    SUPPLIER_DOCUMENTATION_APPROVED: 'supplier.documentation_approved',
    SUPPLIER_CONTRACT_CONCLUDED: 'supplier.contract_concluded',
    // Fornecedor (agendados)
    SUPPLIER_INITIAL_DEADLINE_REMINDER: 'supplier.initial_deadline_reminder',
    SUPPLIER_INITIAL_DEADLINE_EXPIRED: 'supplier.initial_deadline_expired',
    SUPPLIER_MONTHLY_OPENED: 'supplier.monthly_opened',
    SUPPLIER_MONTHLY_REMINDER: 'supplier.monthly_reminder',
    SUPPLIER_MONTHLY_LAST_DAY: 'supplier.monthly_last_day',
    SUPPLIER_MONTHLY_OVERDUE: 'supplier.monthly_overdue',
    // Compras
    PURCHASING_CONTRACT_BLOCKED: 'purchasing.contract_blocked',
    PURCHASING_INITIAL_DEADLINE_EXPIRED: 'purchasing.initial_deadline_expired',
    // RH
    RH_DIGEST: 'rh.digest',
});

/**
 * Definição de cada tipo: tópico, público e textos da tela de Parâmetros.
 * scheduled: disparado pelo agendador (data / hora), não por uma ação.
 */
export const EVENT_DEFINITIONS = Object.freeze({
    [EVENT_TYPES.SUPPLIER_ACCESS_CODE]: {
        topic: TOPICS.SECURITY,
        audience: AUDIENCES.SUPPLIER,
        label: 'Código de acesso (login)',
        description: 'Código de 6 dígitos do login do fornecedor. Sempre ligado; vencido (10 min), não é enviado.',
        // Sempre ligado: não aparece para ligar / desligar em Parâmetros
        system: true,
    },
    [EVENT_TYPES.SUPPLIER_INVITED]: {
        topic: TOPICS.SUPPLIER,
        audience: AUDIENCES.SUPPLIER,
        label: 'Indicação do fornecedor',
        description: 'Convite com o link do contrato quando Compras indica, reenvia ou troca o fornecedor.',
    },
    [EVENT_TYPES.SUPPLIER_DEADLINE_CHANGED]: {
        topic: TOPICS.SUPPLIER,
        audience: AUDIENCES.SUPPLIER,
        label: 'Prazo dos documentos alterado',
        description: 'Quando Compras muda o prazo dos documentos iniciais do contrato.',
    },
    [EVENT_TYPES.SUPPLIER_ACCESS_REMOVED]: {
        topic: TOPICS.SUPPLIER,
        audience: AUDIENCES.SUPPLIER,
        label: 'Fornecedor trocado (perdeu o acesso)',
        description: 'Ao fornecedor anterior, quando Compras troca o fornecedor do contrato.',
    },
    [EVENT_TYPES.SUPPLIER_DOCUMENT_RETURNED]: {
        topic: TOPICS.SUPPLIER,
        audience: AUDIENCES.SUPPLIER,
        label: 'Documento reprovado ou com reenvio',
        description: 'Quando o RH reprova ou pede o reenvio de um documento (iniciais e mensais), com o motivo.',
    },
    [EVENT_TYPES.SUPPLIER_DOCUMENTATION_APPROVED]: {
        topic: TOPICS.SUPPLIER,
        audience: AUDIENCES.SUPPLIER,
        label: 'Documentação aprovada (serviço liberado)',
        description: 'Quando o RH aprova todos os documentos iniciais e o contrato vai para Serviço em andamento.',
    },
    [EVENT_TYPES.SUPPLIER_CONTRACT_CONCLUDED]: {
        topic: TOPICS.SUPPLIER,
        audience: AUDIENCES.SUPPLIER,
        label: 'Contrato concluído',
        description: 'Quando RH ou Compras concluem o contrato (diz até que mês os mensais são cobrados).',
    },
    [EVENT_TYPES.SUPPLIER_INITIAL_DEADLINE_REMINDER]: {
        topic: TOPICS.SUPPLIER,
        audience: AUDIENCES.SUPPLIER,
        label: 'Prazo dos documentos iniciais acabando',
        description: 'Lembrete antes do fim do prazo (horas em "Prazos dos avisos"), com o que ainda falta enviar.',
        scheduled: true,
    },
    [EVENT_TYPES.SUPPLIER_INITIAL_DEADLINE_EXPIRED]: {
        topic: TOPICS.SUPPLIER,
        audience: AUDIENCES.SUPPLIER,
        label: 'Prazo dos documentos iniciais vencido',
        description: 'Quando o prazo acaba sem o fornecedor ter enviado tudo.',
        scheduled: true,
    },
    [EVENT_TYPES.SUPPLIER_MONTHLY_OPENED]: {
        topic: TOPICS.SUPPLIER,
        audience: AUDIENCES.SUPPLIER,
        label: 'Mensais: competência aberta',
        description: 'No dia de abertura, para todos os fornecedores com contrato em andamento.',
        scheduled: true,
    },
    [EVENT_TYPES.SUPPLIER_MONTHLY_REMINDER]: {
        topic: TOPICS.SUPPLIER,
        audience: AUDIENCES.SUPPLIER,
        label: 'Mensais: lembrete',
        description: 'No dia do lembrete, para quem ainda tem documento do mês a enviar.',
        scheduled: true,
    },
    [EVENT_TYPES.SUPPLIER_MONTHLY_LAST_DAY]: {
        topic: TOPICS.SUPPLIER,
        audience: AUDIENCES.SUPPLIER,
        label: 'Mensais: último dia do prazo',
        description: 'No último dia do prazo, para quem ainda tem documento do mês a enviar.',
        scheduled: true,
    },
    [EVENT_TYPES.SUPPLIER_MONTHLY_OVERDUE]: {
        topic: TOPICS.SUPPLIER,
        audience: AUDIENCES.SUPPLIER,
        label: 'Mensais: prazo vencido (atrasado)',
        description: 'No dia seguinte ao prazo, para quem ainda não enviou (o envio continua aceito, como atrasado).',
        scheduled: true,
    },
    [EVENT_TYPES.PURCHASING_CONTRACT_BLOCKED]: {
        topic: TOPICS.INTERNAL,
        audience: AUDIENCES.PURCHASING,
        label: 'Fornecedor sem documento da empresa',
        description: 'Aviso a Compras quando o fornecedor declara que não tem um documento da empresa (solicitação bloqueada).',
    },
    [EVENT_TYPES.PURCHASING_INITIAL_DEADLINE_EXPIRED]: {
        topic: TOPICS.INTERNAL,
        audience: AUDIENCES.PURCHASING,
        label: 'Prazo dos documentos iniciais vencido',
        description: 'Aviso a Compras quando o prazo acaba sem o fornecedor ter enviado tudo (alterar o prazo ou trocar o fornecedor).',
        scheduled: true,
    },
    [EVENT_TYPES.RH_DIGEST]: {
        topic: TOPICS.INTERNAL,
        audience: AUDIENCES.RH,
        label: 'Resumo do RH',
        description: 'A cada X horas (Prazos dos avisos): documentos enviados e reenviados por fornecedor e contrato, declarações, bloqueios e prazos vencidos. Sem novidade, não sai e-mail.',
        scheduled: true,
    },
});

export function eventDefinition(type) {
    return EVENT_DEFINITIONS[type] ?? null;
}

export const EVENT_TYPE_LIST = Object.keys(EVENT_DEFINITIONS);

// Avisos que o Admin liga / desliga em Parâmetros (os de sistema ficam sempre ligados)
export const TOGGLEABLE_EVENT_TYPES = EVENT_TYPE_LIST.filter((type) => !EVENT_DEFINITIONS[type].system);
