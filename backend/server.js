import 'dotenv/config';
import express from 'express';
import path from 'path';
import morgan from 'morgan';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import routes from './src/routers/index.js';
import cors from 'cors';
import { processExpiredPhase2Deadlines } from './src/services/phase2Service.js';
import { ensureInitialAdmin } from './src/services/bootstrapService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sem estes segredos, login e sessão só quebram na hora do uso (ex.: o OTP do fornecedor é
// consumido e a resposta vem 500). Melhor parar na subida dizendo o que falta.
const REQUIRED_SECRETS = ['JWT_SECRET', 'SUPPLIER_JWT_SECRET', 'SESSION_SECRET'];
const missingSecrets = REQUIRED_SECRETS.filter((name) => !process.env[name]);
if (missingSecrets.length > 0) {
    console.error(`Variáveis obrigatórias ausentes no .env: ${missingSecrets.join(', ')}`);
    process.exit(1);
}

const app = express();
const port = process.env.PORT || 3000;
const ambiente = process.env.NODE_ENV || 'production';

// Atrás de proxy reverso (HTTPS em produção): TRUST_PROXY = nº de proxies na frente (ex.: 1).
// Com isso req.ip (auditoria) e req.secure (cookie da sessão) passam a ler os cabeçalhos
// X-Forwarded-*. Vazio = desligado: sem proxy, esses cabeçalhos poderiam ser forjados.
if (process.env.TRUST_PROXY) {
    const hops = Number(process.env.TRUST_PROXY);
    app.set('trust proxy', Number.isInteger(hops) ? hops : process.env.TRUST_PROXY);
}

app.use(cors({
    origin: process.env.FRONTEND_URL, // A URL exata do seu frontend
    credentials: true,               // Permite o envio/recebimento de cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Métodos permitidos
    // O front (outra porta) precisa ler o nome do arquivo nos downloads
    exposedHeaders: ['Content-Disposition'],
}));

// Middleware
// 'combined' em produção (formato padrão de log de acesso); 'dev' (colorido) fora dela
app.use(morgan(ambiente === 'production' ? 'combined' : 'dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Sessão: só guarda o OTP pendente do login do fornecedor (fica em memória)
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    // Só cria sessão quando há algo para guardar (o login do fornecedor), não a cada requisição
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60, // 1 hora
        httpOnly: true,
        sameSite: 'lax',
        // Secure quando a requisição chega por HTTPS (atrás de proxy, depende do TRUST_PROXY)
        secure: 'auto',
    },
}));

// Routes
app.use('/', routes);

// 404
app.use((req, res) => {
    res.status(404).json({ success: false, body: { message: 'Página não encontrada.' } });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ success: false, body: { message: 'Erro interno.' } });
});

// iniciar servidor
(async () => {
    try {
        app.listen(port, '0.0.0.0', () => {
            console.log(`Servidor rodando e acessível na rede na porta: ${port}`);
            console.log(`Ambiente: ${process.env.NODE_ENV || 'production'}`);
        });

        // Admin inicial (USER_ADMIN / SENHA_ADMIN): criado só se o e-mail ainda não existir
        ensureInitialAdmin().catch((err) => {
            console.error('[Bootstrap] Erro ao criar o Admin inicial:', err.message);
        });

        // Job de expiração da Fase 2: roda a cada 5 minutos
        // Verifica deadlines vencidos e desclassifica fornecedores que não enviaram docs
        const PHASE2_JOB_INTERVAL_MS = 5 * 60 * 1000;
        setInterval(async () => {
            try {
                const processed = await processExpiredPhase2Deadlines();
                if (processed > 0) {
                    console.log(`[Phase2 Job] ${processed} deadline(s) expirado(s) processado(s).`);
                }
            } catch (err) {
                console.error('[Phase2 Job] Erro:', err.message);
            }
        }, PHASE2_JOB_INTERVAL_MS);

    } catch (err) {
        console.error('Erro ao inicializar servidor:', err.message);
        process.exit(1);
    }
})();