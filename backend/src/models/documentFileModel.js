// importando a configuração do banco de dados
import { sql, poolPromise } from '../config/dbConfig.js';

/**
 * Documentos para download, com o que é preciso para montar o nome no ZIP
 * (fornecedor, solicitação, colaborador e tipo). file_path é interno: não sai na resposta.
 * Ids inexistentes simplesmente não vêm.
 */
export async function getDocumentFilesByIds(ids) {
    if (!ids || ids.length === 0) return [];

    const pool = await poolPromise;
    const request = pool.request();
    const params = ids.map((id, index) => {
        request.input(`id${index}`, sql.Int, id);
        return `@id${index}`;
    });

    const result = await request.query(`
        SELECT
            d.id,
            d.file_name,
            d.file_path,
            d.mime_type,
            d.supplier_id,
            s.razao_social   AS supplier_name,
            d.labor_request_id,
            lr.title         AS labor_request_title,
            d.employee_id,
            e.full_name      AS employee_name,
            dt.[name]        AS document_type_name,
            dt.category
        FROM documents AS d
        INNER JOIN suppliers      AS s  ON s.id  = d.supplier_id
        INNER JOIN document_types AS dt ON dt.id = d.document_type_id
        LEFT  JOIN labor_requests AS lr ON lr.id = d.labor_request_id
        LEFT  JOIN employees      AS e  ON e.id  = d.employee_id
        WHERE d.id IN (${params.join(', ')})
    `);
    return result.recordset;
}
