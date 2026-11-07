// importando a configuração do banco de dados
import {sql, poolPromise} from '../config/dbConfig.js';

// Atividades ativas. As colunas legado (nr_type_id, document_type_id, is_mandatory) não são
// mais lidas: os documentos sugeridos ficam em activity_type_documents.
export async function getActivityTypes() {
    const pool = await poolPromise;
    const result = await pool.request()
        .query('SELECT id, [name], risk_level, [description] FROM activity_types WHERE is_active = 1');

    return result.recordset;
}

// Só as NRs cujo tipo de documento (categoria 2) está ativo
export async function getNrTypes() {
    const pool = await poolPromise;
    const result = await pool.request()
        .query(`
            SELECT nr.id, nr.code, nr.[name], nr.[description]
            FROM nr_types nr
            INNER JOIN document_types dt ON dt.nr_type_id = nr.id AND dt.is_active = 1
            ORDER BY nr.code
        `);

    return result.recordset;
}

// Tipos de documento da empresa (categoria 0) ativos
export async function getDocumentTypes() {
    const pool = await poolPromise;
    const result = await pool.request()
        .query(`
            SELECT id, [name], scope, validation_method, api_endpoint, required_fields, validity_days,
                   [description], category, has_expiration
            FROM document_types
            WHERE is_active = 1 AND category = 0
        `);

    return result.recordset;
}

// Tipos de documento do colaborador ativos, básicos (categoria 1) e outros (categoria 3).
// As NRs (categoria 2) vêm de getNrTypes.
export async function getEmployeeDocumentTypes() {
    const pool = await poolPromise;
    const result = await pool.request()
        .query(`
            SELECT id, [name], [description], category, has_expiration, validity_days
            FROM document_types
            WHERE is_active = 1 AND category IN (1, 3)
            ORDER BY category, [name]
        `);

    return result.recordset;
}
