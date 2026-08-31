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
