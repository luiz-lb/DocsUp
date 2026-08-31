import * as authService from '../services/authService.js';

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

        res.cookie('token', tokenESuccess.token, {
            httpOnly: true,  // Impede acesso via JavaScript (Protege contra XSS)
            secure: process.env.NODE_ENV === 'production', // true em produção (exige HTTPS)
            sameSite: 'Lax', // Protege contra CSRF (Cross-Site Request Forgery)
            maxAge: 3600000 // 1 hora em milissegundos
        });

        console.log(`Usuário ${email} logado com sucesso.`);

        return res.status(200).json({ success: true, body });

    } catch (error) {
        console.error('Erro no login controller:', error);
        return res.status(500).json({ success: false, body: { message: "Erro interno do servidor." } });
    }

}

export async function registerNewUser(req, res, next) {
    try {
        const { name, email, departament, role, password } = req.body;

        if (!name || !email || !departament || !role || !password) {
            return res.status(400).json({ success: false, body: { message: 'Os campos nome, email, departamento, regra e senha são obrigatórios.' } });
        }

        const registerResult = await authService.registerNewUser({ name, email, departament, role, password });
        if (!registerResult.success) {
            return res.status(400).json({ success: false, body: { message: registerResult.message } });
        }

        res.cookie('token', registerResult.token, {
            httpOnly: true,  // Impede acesso via JavaScript (Protege contra XSS)
            secure: process.env.NODE_ENV === 'production', // true em produção (exige HTTPS)
            sameSite: 'Lax', // Protege contra CSRF (Cross-Site Request Forgery)
            maxAge: 3600000 // 1 hora em milissegundos
        });

        console.log(`Usuário ${email} logado com sucesso.`);
        
        return res.status(201).json({ success: true, body: { message: 'Usuário registrado com sucesso.', id: registerResult.id, email} });
    } catch (error) {
        console.error('Erro no register controller:', error);
        return res.status(500).json({ success: false, body: { message: "Erro interno do servidor." } });
    }
}

export async function getMe(req, res, next) {
    try{
        const usuario = req.usuario; 

        console.log('Informações do usuário extraídas do token:', usuario);

        return res.status(200).json({ success: true, body: { message: 'Usuário autenticado.', id: usuario.id, email: usuario.email, name: usuario.name, department: usuario.department, role: usuario.role } });
    } catch (error) {
        console.error('Erro no getMe controller:', error);
        return res.status(500).json({ success: false, body: { message: "Erro interno do servidor." } });
    }
}
