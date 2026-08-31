// importando a configuração do banco de dados
import {sql, poolPromise} from '../config/dbConfig.js';

export async function getActivityTypes() {
    const pool = await poolPromise;
    const result = await pool.request()
        .query('SELECT id, [name], risk_level, [description], document_type_id, is_mandatory, nr_type_id FROM activity_types WHERE is_active = 1');

    return result.recordset;
}

export async function getNrTypes() {
    const pool = await poolPromise;
    const result = await pool.request()
        .query('SELECT id, code, [name], [description] FROM nr_types');

    return result.recordset;
}

export async function getDocumentTypes() {
    const pool = await poolPromise;
    const result = await pool.request()
        .query('SELECT id, [name], scope, validation_method, api_endpoint, required_fields, validity_days, [description] FROM document_types WHERE is_active = 1');

    return result.recordset;
}