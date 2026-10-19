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