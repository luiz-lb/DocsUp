// Regra de senha dos usuários internos (a mesma do SQL Server): mínimo de 8 caracteres
// e ao menos 3 destes 4 grupos: maiúsculas, minúsculas, números e símbolos.
export const PASSWORD_MIN_LENGTH = 8;

const CHARACTER_GROUPS = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/];

/** Retorna a mensagem do problema, ou null se a senha atende à regra. */
export function getPasswordPolicyError(password) {
    if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
        return `A senha precisa ter ao menos ${PASSWORD_MIN_LENGTH} caracteres.`;
    }

    const groups = CHARACTER_GROUPS.filter((group) => group.test(password)).length;
    if (groups < 3) {
        return 'A senha precisa ter 3 destes 4 grupos: maiúsculas, minúsculas, números e símbolos.';
    }

    return null;
}
