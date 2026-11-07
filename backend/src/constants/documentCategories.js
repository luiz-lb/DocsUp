// document_types.category (TINYINT). O scope (0 Empresa / 1 Colaborador) é derivado dela,
// menos no Trabalhista mensal, que pode ser da empresa ou de cada colaborador.
export const DOCUMENT_CATEGORIES = Object.freeze({
    COMPANY: 0,             // Empresa
    EMPLOYEE_BASIC: 1,      // Colaborador: básico (exigido de todo colaborador)
    EMPLOYEE_NR: 2,         // Colaborador: NR (ligado a nr_types)
    EMPLOYEE_OTHER: 3,      // Colaborador: outros
    MONTHLY: 4,             // Trabalhista mensal (todo mês, em todos os contratos)
});

export const DOCUMENT_CATEGORY_IDS = Object.values(DOCUMENT_CATEGORIES);

// Categorias de documento de colaborador (documentos iniciais do contrato)
export const EMPLOYEE_DOCUMENT_CATEGORIES = [
    DOCUMENT_CATEGORIES.EMPLOYEE_BASIC,
    DOCUMENT_CATEGORIES.EMPLOYEE_NR,
    DOCUMENT_CATEGORIES.EMPLOYEE_OTHER,
];

// document_types.scope
export const DOCUMENT_SCOPES = Object.freeze({
    COMPANY: 0,
    EMPLOYEE: 1,
});

/**
 * document_types.scope pela categoria (o CHECK do banco exige essa combinação). No mensal o
 * escopo é escolhido (monthlyScope: 0 empresa / 1 colaborador).
 */
export function scopeForCategory(category, monthlyScope = null) {
    if (category === DOCUMENT_CATEGORIES.MONTHLY) return monthlyScope;
    return category === DOCUMENT_CATEGORIES.COMPANY ? DOCUMENT_SCOPES.COMPANY : DOCUMENT_SCOPES.EMPLOYEE;
}
