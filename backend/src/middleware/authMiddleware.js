import jwt from 'jsonwebtoken';

// Middleware para verificar o token JWT
export function verificarToken(req, res, next) {
  // Requer o 'cookie-parser' configurado no app.js: app.use(cookieParser())
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ success: false, body: { message: 'Acesso negado. Token não fornecido.' } });
  }

  try {
    // Verifica a assinatura e a validade do token
    const decodificado = jwt.verify(token, process.env.JWT_SECRET);
    
    // Anexa as informações do usuário à requisição para usar nos controllers
    req.usuario = decodificado;
    
    // Passa para a próxima função (o controller da rota)
    next(); 
  } catch (erro) {
    return res.status(401).json({success: false, body: { message: 'Token inválido ou expirado.' } });
  }
};