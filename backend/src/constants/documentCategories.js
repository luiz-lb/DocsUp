// document_types.category (TINYINT). O scope (0 Empresa / 1 Colaborador) é derivado dela.
export const DOCUMENT_CATEGORIES = Object.freeze({
    COMPANY: 0,             // Empresa
    EMPLOYEE_BASIC: 1,      // Colaborador: básico (exigido de todo colaborador)
    EMPLOYEE_NR: 2,         // Colaborador: NR (ligado a nr_types)
    EMPLOYEE_OTHER: 3,      // Colaborador: outros
});

export const DOCUMENT_CATEGORY_IDS = Object.values(DOCUMENT_CATEGORIES);

// Categorias de documento de colaborador
export const EMPLOYEE_DOCUMENT_CATEGORIES = [
    DOCUMENT_CATEGORIES.EMPLOYEE_BASIC,
    DOCUMENT_CATEGORIES.EMPLOYEE_NR,
    DOCUMENT_CATEGORIES.EMPLOYEE_OTHER,
];

// document_types.scope derivado da categoria (o CHECK do banco exige essa combinação)
export function scopeForCategory(category) {
    return category === DOCUMENT_CATEGORIES.COMPANY ? 0 : 1;
}

// document_types.validation_method dos tipos criados pelo Admin: 2 = Manual
export const MANUAL_VALIDATION_METHOD = 2;
