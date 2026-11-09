import {sql, poolPromise} from '../config/dbConfig.js'

export async function iniciarTransacao() {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    return transaction;
}

export async function finalizarTransacao(transaction, sucesso = true) {
    if (sucesso) {
        await transaction.commit();
    } else {
        await transaction.rollback();
    }
}

/**
 * Roda `trabalho(transaction)` numa transação: confirma se terminar bem e desfaz
 * tudo se qualquer passo lançar erro (o erro é relançado para quem chamou).
 */
export async function executarEmTransacao(trabalho) {
    const transaction = await iniciarTransacao();
    try {
        const resultado = await trabalho(transaction);
        await finalizarTransacao(transaction, true);
        return resultado;
    } catch (error) {
        try {
            await finalizarTransacao(transaction, false);
        } catch (rollbackError) {
            console.error('Erro ao desfazer a transação:', rollbackError.message);
        }
        throw error;
    }
}
const DEADLOCK = 1205;

function isDeadlock(error) {
    return error?.number === DEADLOCK || error?.originalError?.info?.number === DEADLOCK
        || error?.precedingErrors?.some((item) => item?.number === DEADLOCK);
}

/**
 * Como executarEmTransacao, mas tenta de novo (até `tentativas` vezes) se o SQL Server
 * escolher esta transação como vítima de deadlock (erro 1205). Só para trabalhos que mexem
 * apenas no banco (nada de arquivo ou rede): a transação derrubada já foi desfeita.
 */
export async function executarEmTransacaoComRetentativa(trabalho, { tentativas = 3 } = {}) {
    for (let tentativa = 1; ; tentativa += 1) {
        try {
            return await executarEmTransacao(trabalho);
        } catch (error) {
            if (!isDeadlock(error) || tentativa >= tentativas) throw error;
            await new Promise((resolve) => setTimeout(resolve, 40 * tentativa + Math.floor(Math.random() * 60)));
        }
    }
}
