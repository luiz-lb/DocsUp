import jwt from 'jsonwebtoken';
import * as authService from '../services/authService.js';

// Middleware para verificar o token JWT do colaborador
export async function verificarToken(req, res, next) {
  // Requer o 'cookie-parser' configurado no app.js: app.use(cookieParser())
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ success: false, body: { message: 'Acesso negado. Token não fornecido.' } });
  }

  let decodificado;
  try {
    // Verifica a assinatura e a validade do token
    decodificado = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (erro) {
    return res.status(401).json({ success: false, body: { message: 'Token inválido ou expirado.' } });
  }

  // Só aceita token de colaborador: o de fornecedor tem type 'supplier' (e outro segredo)
  if (decodificado.type !== 'user' || !decodificado.id) {
    return res.status(401).json({ success: false, body: { message: 'Token inválido para este recurso.' } });
  }

  // Lê o usuário no banco a cada requisição: inativação e troca de departamento valem na hora
  let usuario;
  try {
    usuario = await authService.getActiveUserById(decodificado.id);
  } catch (erro) {
    console.error('Erro no verificarToken ao buscar o usuário:', erro);
    return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
  }

  if (!usuario) {
    return res.status(401).json({ success: false, body: { message: 'Usuário inativo ou não encontrado.' } });
  }

  // Tokens emitidos antes de sessions_valid_after não valem mais (ex.: senha redefinida).
  // O iat do JWT tem precisão de segundo, então a comparação é feita em segundos.
  const { sessions_valid_after: sessionsValidAfter, ...dadosUsuario } = usuario;
  if (sessionsValidAfter) {
    const validAfterSeconds = Math.floor(new Date(sessionsValidAfter).getTime() / 1000);
    if (!decodificado.iat || decodificado.iat < validAfterSeconds) {
      return res.status(401).json({ success: false, body: { message: 'Sessão encerrada. Faça login novamente.' } });
    }
  }

  // Anexa as informações do usuário à requisição para usar nos controllers
  req.usuario = dadosUsuario;

  // Passa para a próxima função (o controller da rota)
  next();
};
