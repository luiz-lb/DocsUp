// supplier_users.role: os dois usuários que entram no portal do fornecedor.
// Espelhado no frontend (SUPPLIER_USER_ROLE em src/constants/enums.js).
export const SUPPLIER_USER_ROLES = Object.freeze({
    OWNER: 0,     // Responsável (dono)
    OPERATOR: 1,  // Operador
});

export const SUPPLIER_USER_ROLE_LABELS = Object.freeze({
    [SUPPLIER_USER_ROLES.OWNER]: 'Responsável',
    [SUPPLIER_USER_ROLES.OPERATOR]: 'Operador',
});

// suppliers.status
export const SUPPLIER_STATUSES = Object.freeze({
    PENDING: 0,
    ACTIVE: 1,
    INACTIVE: 2,
    BLOCKED: 3,
});
