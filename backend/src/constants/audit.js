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
    DOCUMENT_TYPE_CREATE: 'document_type.create',
    DOCUMENT_TYPE_UPDATE: 'document_type.update',
    DOCUMENT_TYPE_ACTIVATE: 'document_type.activate',
    DOCUMENT_TYPE_INACTIVATE: 'document_type.inactivate',
    ACTIVITY_CREATE: 'activity.create',
    ACTIVITY_UPDATE: 'activity.update',
    ACTIVITY_ACTIVATE: 'activity.activate',
    ACTIVITY_INACTIVATE: 'activity.inactivate',
    DOCUMENT_DOWNLOAD: 'document.download',
    DOCUMENT_DOWNLOAD_ZIP: 'document.download_zip',
    DOCUMENT_STATUS_CHANGE: 'document.status_change',
});

// audit_log.entity_type
export const AUDIT_ENTITIES = Object.freeze({
    USER: 'user',
    DOCUMENT_TYPE: 'document_type',
    ACTIVITY: 'activity',
    DOCUMENT: 'document',
});
