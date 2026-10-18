export function isValidCnpj(value) {
  const cnpj = String(value ?? '').replace(/\D/g, '');
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const calcDigit = (base) => {
    let weight = base.length - 7;
    const sum = base.split('').reduce((acc, digit) => {
      acc += Number(digit) * weight;
      weight = weight === 2 ? 9 : weight - 1;
      return acc;
    }, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const base = cnpj.slice(0, 12);
  const digit1 = calcDigit(base);
  const digit2 = calcDigit(base + digit1);
  return cnpj === base + String(digit1) + String(digit2);
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? ''));
}

// Mesma regra de senha do backend (backend/src/utils/passwordPolicy.js): mínimo de
// 8 caracteres e 3 destes 4 grupos: maiúsculas, minúsculas, números e símbolos.
export const PASSWORD_RULE_HINT = 'Mínimo de 8 caracteres, com 3 destes 4 grupos: maiúsculas, minúsculas, números e símbolos.';

/** Retorna a mensagem do problema, ou null se a senha atende à regra. */
export function getPasswordPolicyError(password) {
  const value = String(password ?? '');
  if (value.length < 8) return 'A senha precisa ter ao menos 8 caracteres.';

  const groups = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((group) => group.test(value)).length;
  if (groups < 3) return 'A senha precisa ter 3 destes 4 grupos: maiúsculas, minúsculas, números e símbolos.';

  return null;
}
