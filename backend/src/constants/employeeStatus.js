// employees.status: situação do colaborador (Fase 8)
export const EMPLOYEE_STATUSES = Object.freeze({
    PENDING_DOCUMENTS: 0,   // Pendente de documentos (padrão)
    DOCUMENTS_OK: 1,        // Documentação OK (RH / Segurança)
    INTEGRATION_SCHEDULED: 2, // Integração agendada (com data e hora)
    RELEASED: 3,            // Liberado
    DOCUMENT_EXPIRING: 4,   // Documento a vencer (rotina diária)
    DISMISSED: 5,           // Desligado
    RETAINED: 6,            // Retido por pendência da empresa (rotina diária)
});

export const EMPLOYEE_STATUS_IDS = Object.values(EMPLOYEE_STATUSES);
