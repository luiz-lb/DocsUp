/**
 * Inteiro vindo do corpo da requisição: aceita número inteiro ou texto só com dígitos
 * ("6", vindo de <select> ou de multipart). Qualquer outra coisa vira NaN.
 */
export function toInteger(value) {
    if (typeof value === 'number') return Number.isInteger(value) ? value : NaN;
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
    return NaN;
}

// Valor ausente: undefined, null ou texto vazio
export function isBlank(value) {
    return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}
