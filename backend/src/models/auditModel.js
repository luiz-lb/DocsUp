// importando a configuração do banco de dados
import { sql, poolPromise } from '../config/dbConfig.js';

/**
 * Grava um registro de auditoria dentro da transação da própria mudança:
 * se a auditoria falhar, a mudança é desfeita junto.
 * old_values / new_values vão como JSON (nunca senha nem hash).
 */
export async function insertAuditLog(transaction, {
    actorType, actorId, action, entityType, entityId, oldValues, newValues, ipAddress, userAgent,
}) {
    const request = new sql.Request(transaction);
    await request
        .input('actor_type', sql.TinyInt, actorType)
        .input('actor_id', sql.Int, actorId ?? null)
        .input('action', sql.VarChar(100), action)
        .input('entity_type', sql.VarChar(50), entityType)
        .input('entity_id', sql.Int, entityId ?? null)
        .input('old_values', sql.NVarChar(sql.MAX), oldValues ? JSON.stringify(oldValues) : null)
        .input('new_values', sql.NVarChar(sql.MAX), newValues ? JSON.stringify(newValues) : null)
        .input('ip_address', sql.VarChar(45), ipAddress ? String(ipAddress).slice(0, 45) : null)
        .input('user_agent', sql.NVarChar(sql.MAX), userAgent ? String(userAgent).slice(0, 500) : null)
        .query(`
            INSERT INTO audit_log
                (actor_type, actor_id, [action], entity_type, entity_id, old_values, new_values, ip_address, user_agent)
            VALUES
                (@actor_type, @actor_id, @action, @entity_type, @entity_id, @old_values, @new_values, @ip_address, @user_agent)
        `);
}

/**
 * Lista a auditoria, mais recente primeiro, com quem fez e o usuário alvo.
 *
 * @param {object} options
 * @param {number} options.page     - Página (1-based).
 * @param {number} options.limit    - Itens por página.
 * @param {string} [options.action] - Filtra por ação (ex.: 'user.update').
 * @param {string} [options.from]   - Data inicial 'YYYY-MM-DD' (inclusiva).
 * @param {string} [options.to]     - Data final 'YYYY-MM-DD' (inclusiva).
 * @param {string} [options.search] - Nome ou e-mail de quem fez ou do alvo.
 * @returns {Promise<{rows: object[], total: number}>}
 */
export async function listAuditLogs({ page = 1, limit = 25, action, from, to, search = '' } = {}) {
    const pool = await poolPromise;
    const offset = (page - 1) * limit;

    const request = pool.request()
        .input('limit', sql.Int, limit)
        .input('offset', sql.Int, offset);

    const conditions = [];

    if (action) {
        request.input('action', sql.VarChar(100), action);
        conditions.push('a.[action] = @action');
    }
    // Datas como calendário (sem fuso): de 00:00 do "from" até o fim do dia do "to"
    if (from) {
        request.input('from', sql.VarChar(10), from);
        conditions.push('a.created_at >= CAST(@from AS DATE)');
    }
    if (to) {
        request.input('to', sql.VarChar(10), to);
        conditions.push('a.created_at < DATEADD(DAY, 1, CAST(@to AS DATE))');
    }
    if (search) {
        request.input('search', sql.NVarChar(210), `%${search}%`);
        conditions.push(`(actor.[name] LIKE @search OR actor.email LIKE @search
                          OR target.[name] LIKE @search OR target.email LIKE @search)`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await request.query(`
        SELECT
            a.id,
            a.actor_type,
            a.actor_id,
            actor.[name]  AS actor_name,
            actor.email   AS actor_email,
            a.[action],
            a.entity_type,
            a.entity_id,
            target.[name] AS target_name,
            target.email  AS target_email,
            a.old_values,
            a.new_values,
            a.ip_address,
            a.user_agent,
            a.created_at,
            COUNT(*) OVER() AS total_count
        FROM audit_log AS a
        LEFT JOIN users AS actor  ON a.actor_type = 0 AND actor.id = a.actor_id
        LEFT JOIN users AS target ON a.entity_type = 'user' AND target.id = a.entity_id
        ${whereClause}
        ORDER BY a.created_at DESC, a.id DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    const rows = result.recordset;
    return {
        rows: rows.map(({ total_count, ...row }) => row),
        total: rows.length > 0 ? rows[0].total_count : 0,
    };
}
