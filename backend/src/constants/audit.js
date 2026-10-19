// Valores do audit_log. Espelhados no frontend (AUDIT_ACTOR_TYPE e AUDIT_ACTION em src/constants/enums.js).

// audit_log.actor_type (TINYINT)
export const AUDIT_ACTOR_TYPES = Object.freeze({
    COLLABORATOR: 0, // usuário interno (users)
    SUPPLIER: 1,     // fornecedor (suppliers)
    SYSTEM: 2,       // o próprio sistema (ex.: Admin inicial do bootstrap)
});

// audit_log.action
export const AUDIT_ACTIONS = Object.freeze({
    USER_CREATE: 'user.create',
    USER_UPDATE: 'user.update',
    USER_ACTIVATE: 'user.activate',
    USER_INACTIVATE: 'user.inactivate',
    USER_PASSWORD_RESET: 'user.password_reset',
});

// audit_log.entity_type
export const AUDIT_ENTITIES = Object.freeze({
    USER: 'user',
});
