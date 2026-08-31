import 'dotenv/config';
import express from 'express';
import path from 'path';
import morgan from 'morgan';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import routes from './src/routers/index.js';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const ambiente = process.env.NODE_ENV || 'production';

app.use(cors({
    origin: process.env.FRONTEND_URL, // A URL exata do seu frontend
    credentials: true,               // Permite o envio/recebimento de cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] // Métodos permitidos
}));

// Middleware
app.use(morgan(ambiente));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 } // 1 hora
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
    } catch (err) {
        console.error('Erro ao inicializar servidor:', err.message);
        process.exit(1);
    }
})();