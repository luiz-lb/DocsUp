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

// ─────────────────────────────────────────────────────────────────────────────
// Regiões (tabela regions) — usada no cadastro de fornecedor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca regiões com filtro opcional por UF e/ou cidade (LIKE, case-insensitive).
 * Retorna no máximo 50 resultados para não sobrecarregar o autocomplete.
 */
export async function searchRegions({ state, city, limit = 50 } = {}) {
    const pool = await poolPromise;
    const request = pool.request()
        .input('limit', sql.Int, limit);

    let where = '1=1';
    if (state) {
        where += ' AND [state] = @state';
        request.input('state', sql.VarChar(2), state.toUpperCase());
    }
    if (city) {
        where += ' AND city LIKE @city';
        request.input('city', sql.NVarChar(150), `%${city}%`);
    }

    const result = await request.query(`
        SELECT TOP (@limit) id, city, [state], country
        FROM regions
        WHERE ${where}
        ORDER BY [state] ASC, city ASC
    `);

    return result.recordset;
}

/**
 * Busca todos os IDs de regiões de um estado inteiro.
 * Usado quando o fornecedor clica "Adicionar estado inteiro".
 */
export async function getRegionIdsByState(state) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('state', sql.VarChar(2), state.toUpperCase())
        .query('SELECT id FROM regions WHERE [state] = @state');

    return result.recordset.map((r) => r.id);
}

/**
 * Busca uma lista de regiões pelos IDs (para exibir os chips selecionados).
 */
export async function getRegionsByIds(ids) {
    if (!ids || ids.length === 0) return [];
    const pool = await poolPromise;
    // Monta lista de parâmetros de forma segura
    const params = ids.map((_, i) => `@id${i}`).join(',');
    const request = pool.request();
    ids.forEach((id, i) => request.input(`id${i}`, sql.Int, id));

    const result = await request.query(
        `SELECT id, city, [state] FROM regions WHERE id IN (${params}) ORDER BY [state], city`
    );
    return result.recordset;
}
