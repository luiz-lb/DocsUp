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