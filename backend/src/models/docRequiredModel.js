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
