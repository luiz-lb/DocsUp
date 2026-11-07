// labor_requests.status. Espelhado no frontend (LABOR_REQUEST_STATUS em src/constants/enums.js).
export const LABOR_REQUEST_STATUSES = Object.freeze({
    PENDING_APPROVAL: 0,   // Pendente de aprovação da Segurança do Trabalho
    REJECTED: 2,           // Reprovada
    AWAITING_SUPPLIER: 3,  // Aprovada: aguardando Compras indicar o fornecedor
    BLOCKED: 4,            // Fornecedor declarou não ter documento da empresa (Compras decide)
    IN_CONTRACTING: 5,     // Fornecedor indicado: declaração e documentos
    CONCLUDED: 6,          // Contrato concluído (encerra a cobrança dos documentos mensais)
    CANCELED: 7,
});

// labor_request_suppliers.status
export const ASSIGNMENT_STATUSES = Object.freeze({
    WAITING_SUPPLIER: 0,   // aguardando o fornecedor (cadastro / declaração)
    ACTIVE: 1,             // declaração e termo aceitos: envia os documentos
    BLOCKED: 2,            // declarou não ter um documento da empresa exigido
    ENDED: 3,              // reenviado ou fornecedor trocado
});

// Vínculos que ainda valem (só um por solicitação)
export const OPEN_ASSIGNMENT_STATUSES = [
    ASSIGNMENT_STATUSES.WAITING_SUPPLIER,
    ASSIGNMENT_STATUSES.ACTIVE,
    ASSIGNMENT_STATUSES.BLOCKED,
];

// labor_request_suppliers.end_reason
export const ASSIGNMENT_END_REASONS = Object.freeze({
    RESENT: 0,     // reenviado para o mesmo e-mail (recomeça do zero)
    REPLACED: 1,   // fornecedor trocado
});

// Prazo dos documentos iniciais: em horas (1 a 720) ou até uma data (no máximo 1 ano à frente)
export const DEADLINE_MAX_HOURS = 720;
export const DEADLINE_MAX_DAYS_AHEAD = 365;

// Limite de funcionários declarados por documento (só para barrar valores absurdos)
export const DECLARATION_MAX_EMPLOYEES = 100000;
