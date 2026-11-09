// Parâmetros do sistema (app_settings): chave → valor (texto)
import { sql, poolPromise } from '../config/dbConfig.js';

/** Todos os parâmetros: Map(chave → valor). */
export async function getAllSettings() {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT setting_key, setting_value FROM app_settings');
    return new Map(result.recordset.map((row) => [row.setting_key, row.setting_value]));
}

export async function setSetting(transaction, key, value, userId) {
    await new sql.Request(transaction)
        .input('key', sql.VarChar(100), key)
        .input('value', sql.NVarChar(500), value)
        .input('user_id', sql.Int, userId ?? null)
        .query(`
            IF EXISTS (SELECT 1 FROM app_settings WHERE setting_key = @key)
                UPDATE app_settings
                SET setting_value = @value, updated_at = GETDATE(), updated_by = @user_id
                WHERE setting_key = @key
            ELSE
                INSERT INTO app_settings (setting_key, setting_value, updated_by)
                VALUES (@key, @value, @user_id)
        `);
}
