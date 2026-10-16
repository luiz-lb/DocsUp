import * as authService from '../services/authService.js';

// Opções do cookie do JWT de colaborador. O logout usa as mesmas para conseguir apagá-lo.
const COLLABORATOR_COOKIE_OPTIONS = {
    httpOnly: true,  // Impede acesso via JavaScript (Protege contra XSS)
    secure: process.env.NODE_ENV === 'production', // true em produção (exige HTTPS)
    sameSite: 'Lax', // Protege contra CSRF (Cross-Site Request Forgery)
    maxAge: 3600000 // 1 hora em milissegundos
};

export async function login(req, res, next) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(401).json({ success: false, body: { message: 'Email e senha é necessario.' } });
        }

        const tokenESuccess = await authService.login(email, password);

        if(tokenESuccess.success === false) {
            return res.status(401).json({ success: false, body: { message: tokenESuccess.message } });
        }

        const body = {message: "Login realizado com sucesso.", id: tokenESuccess.id, email, name: tokenESuccess.name, department: tokenESuccess.department, role: tokenESuccess.role};

        res.cookie('token', tokenESuccess.token, COLLABORATOR_COOKIE_OPTIONS);

        console.log(`Usuário ${email} logado com sucesso.`);

        return res.status(200).json({ success: true, body });

    } catch (error) {
        console.error('Erro no login controller:', error);
        return res.status(500).json({ success: false, body: { message: "Erro interno do servidor." } });
    }

}

export async function logout(req, res) {
    res.clearCookie('token', COLLABORATOR_COOKIE_OPTIONS);
    return res.status(200).json({ success: true, body: { message: 'Logout realizado.' } });
}

export async function getMe(req, res, next) {
    try{
        const usuario = req.usuario;

        // Evita logar PII do usuário (nome/email) — registra apenas o id.
        console.log(`getMe: usuário ${usuario?.id} autenticado.`);

        return res.status(200).json({ success: true, body: { message: 'Usuário autenticado.', id: usuario.id, email: usuario.email, name: usuario.name, department: usuario.department, role: usuario.role } });
    } catch (error) {
        console.error('Erro no getMe controller:', error);
        return res.status(500).json({ success: false, body: { message: "Erro interno do servidor." } });
    }
}
