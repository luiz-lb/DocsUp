import sql from 'mssql';

const dbConfig = {
    user: process.env.DB_USERENV,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: Number(process.env.DB_PORT || 1433),
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
        // O banco grava hora local (GETDATE / SYSDATETIMEOFFSET em America/Sao_Paulo): lê e
        // grava datas no fuso local do Node. Com o padrão (UTC), tudo ficava 3h deslocado.
        // O backend precisa rodar no mesmo fuso do SQL Server (TZ=America/Sao_Paulo).
        useUTC: false,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function connectWithRetry() {
    while (true) {
        try {
            const pool = await new sql.ConnectionPool(dbConfig).connect();
            pool.on('error', (err) => {
                console.error('SQL Server pool error:', err);
            });
            console.log('✅ Connected to SQL Server');
            return pool;
        } catch (err) {
            console.error('❌ Falha ao conectar ao SQL Server. Tentando novamente em 5 segundos...', err.message || err);
            await sleep(5000);
        }
    }
}

const poolPromise = connectWithRetry();

export { sql, poolPromise };