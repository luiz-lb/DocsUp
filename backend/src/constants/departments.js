// Espelha users.department (TINYINT) e o DEPARTMENT do frontend (src/constants/enums.js)
export const DEPARTMENTS = Object.freeze({
    RH: 0,
    SEGURANCA_TRABALHO: 1,
    SUPRIMENTOS: 2,
    FISCAL: 3,
    FINANCEIRO: 4,
    OBRA: 5,
    ADMIN: 6,
});

export const DEPARTMENT_IDS = Object.values(DEPARTMENTS);
