// document_types.validation_method
export const VALIDATION_METHODS = Object.freeze({
    API: 0,      // API pública (integração escolhida em api_endpoint)
    AI: 1,       // IA via N8N (instrução em ai_instructions)
    MANUAL: 2,   // RH / Segurança validam à mão (padrão)
    HYBRID: 3,   // API + IA: existe no banco, mas não é oferecido na tela
});

// Métodos que o Admin pode escolher em Parâmetros
export const SELECTABLE_VALIDATION_METHODS = [VALIDATION_METHODS.MANUAL, VALIDATION_METHODS.API, VALIDATION_METHODS.AI];

/**
 * Integrações de API prontas para uso: { key, label }. A chave vai em document_types.api_endpoint.
 * Vazia por enquanto: os rascunhos em documentValidationService (cnd_federal, crf_fgts,
 * trabalhista) ainda não são confiáveis. Uma integração entra aqui quando ficar pronta.
 */
export const AVAILABLE_API_INTEGRATIONS = Object.freeze([]);

export const AI_INSTRUCTIONS_MAX_LENGTH = 4000;
