// E-mail de login (fornecedor): sem espaços nas pontas, em minúsculas, formato básico e
// até 200 caracteres (supplier_users.email / labor_request_suppliers.invite_email).
export const EMAIL_MAX_LENGTH = 200;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** E-mail normalizado, ou null se não for um e-mail válido. */
export function normalizeEmail(value) {
    if (typeof value !== 'string') return null;
    const email = value.trim().toLowerCase();
    if (!email || email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) return null;
    return email;
}
