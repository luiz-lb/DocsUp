// CNPJ: só dígitos, dígitos verificadores e formatação (00.000.000/0000-00)

/** Só os dígitos do CNPJ ('' se não for texto). */
export function cnpjDigits(value) {
    return typeof value === 'string' || typeof value === 'number'
        ? String(value).replace(/\D/g, '')
        : '';
}

function checkDigit(digits, weights) {
    const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
}

/** 14 dígitos, não repetidos e com os dois dígitos verificadores certos. */
export function isValidCnpj(value) {
    const digits = cnpjDigits(value);
    if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;

    const first = checkDigit(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const second = checkDigit(digits, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return first === Number(digits[12]) && second === Number(digits[13]);
}

/** '12345678000195' → '12.345.678/0001-95' (como fica gravado em suppliers.cnpj). */
export function formatCnpj(value) {
    const digits = cnpjDigits(value);
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}
