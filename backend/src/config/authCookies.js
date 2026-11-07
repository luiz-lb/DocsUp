// Opções do cookie do JWT de colaborador ('token'). Login, logout e a reemissão do
// cookie (Admin que redefine a própria senha) usam as mesmas, senão o clearCookie não apaga.
export const COLLABORATOR_COOKIE_OPTIONS = {
    httpOnly: true,  // Impede acesso via JavaScript (Protege contra XSS)
    secure: process.env.NODE_ENV === 'production', // true em produção (exige HTTPS)
    sameSite: 'Lax', // Protege contra CSRF (Cross-Site Request Forgery)
    maxAge: 3600000, // 1 hora em milissegundos
};

// Opções do cookie do JWT de fornecedor ('supplier_token'): login, troca de senha e logout
export const SUPPLIER_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 4 * 60 * 60 * 1000, // 4 horas (mesma validade do JWT)
};
