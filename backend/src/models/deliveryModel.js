// importando a configuração do banco de dados
import { sql, poolPromise } from '../config/dbConfig.js';

// Entrega = uma linha de documents. As entregas do mesmo documento (fornecedor + solicitação +
// tipo + colaborador, ou empresa quando employee_id é nulo) formam o histórico; a atual tem
// is_current = 1. A observação é a da análise manual mais recente do RH (document_validations,
// validation_type = 2).

// Mesma "vaga" de documento entre a entrega h e a entrega d
const SAME_SLOT = `
    h.supplier_id = d.supplier_id
    AND h.document_type_id = d.document_type_id
    AND ((h.labor_request_id IS NULL AND d.labor_request_id IS NULL) OR h.labor_request_id = d.labor_request_id)
    AND ((h.employee_id IS NULL AND d.employee_id IS NULL) OR h.employee_id = d.employee_id)
`;

// Última análise manual de uma entrega (alias da entrega: h)
const LATEST_REVIEW = `
    OUTER APPLY (
        SELECT TOP (1) v.manual_comments, v.reviewed_at, v.reviewer_id
        FROM document_validations AS v
        WHERE v.document_id = h.id AND v.validation_type = 2
        ORDER BY v.id DESC
    ) AS review
    LEFT JOIN users AS reviewer ON reviewer.id = review.reviewer_id
`;

// Campos de uma entrega no histórico (file_path é interno: não sai)
const DELIVERY_FIELDS = `
    h.id,
    h.[version],
    CAST(ISNULL(h.is_current, 0) AS BIT) AS is_current,
    h.[status],
    h.file_name,
    h.expires_at,
    h.uploaded_at,
    review.manual_comments AS observation,
    review.reviewed_at,
    reviewer.[name] AS reviewer_name
`;

/**
 * Histórico do documento de uma entrega: todas as entregas da mesma vaga, mais nova primeiro.
 * Retorna [] se o documento não existir.
 */
export async function getDeliveryHistory(documentId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, documentId)
        .query(`
            SELECT ${DELIVERY_FIELDS}
            FROM documents AS d
            INNER JOIN documents AS h ON ${SAME_SLOT}
            ${LATEST_REVIEW}
            WHERE d.id = @id
            ORDER BY h.uploaded_at DESC, h.id DESC
        `);
    return result.recordset;
}

/**
 * Todas as entregas (atuais e antigas) de um fornecedor numa solicitação, com a observação
 * da última análise. O service agrupa por vaga para montar o histórico de cada documento.
 */
export async function listSupplierDeliveries(supplierId, laborRequestId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('supplier_id', sql.Int, supplierId)
        .input('labor_request_id', sql.Int, laborRequestId)
        .query(`
            SELECT ${DELIVERY_FIELDS}, h.document_type_id, h.employee_id
            FROM documents AS h
            ${LATEST_REVIEW}
            WHERE h.supplier_id = @supplier_id
              AND h.labor_request_id = @labor_request_id
            ORDER BY h.uploaded_at DESC, h.id DESC
        `);
    return result.recordset;
}

/**
 * Status da entrega atual de um documento (ou null se nunca foi enviado). Usado para
 * liberar o reenvio depois do prazo da Fase 2 (só reprovado ou reenvio necessário).
 * employeeId nulo = documento da empresa.
 */
export async function getCurrentDeliveryStatus({ supplierId, laborRequestId, documentTypeId, employeeId = null }) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('supplier_id', sql.Int, supplierId)
        .input('labor_request_id', sql.Int, laborRequestId)
        .input('document_type_id', sql.Int, documentTypeId)
        .input('employee_id', sql.Int, employeeId)
        .query(`
            SELECT TOP (1) [status]
            FROM documents
            WHERE supplier_id = @supplier_id
              AND labor_request_id = @labor_request_id
              AND document_type_id = @document_type_id
              AND ((@employee_id IS NULL AND employee_id IS NULL) OR employee_id = @employee_id)
              AND is_current = 1
            ORDER BY id DESC
        `);
    return result.recordset[0]?.status ?? null;
}

/** Entrega para a análise do RH: status, se é a atual e a observação da última análise. */
export async function getDeliveryForReview(documentId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, documentId)
        .query(`
            SELECT
                h.id,
                h.[status],
                CAST(ISNULL(h.is_current, 0) AS BIT) AS is_current,
                h.file_name,
                dt.[name] AS document_type_name,
                review.manual_comments AS observation
            FROM documents AS h
            INNER JOIN document_types AS dt ON dt.id = h.document_type_id
            ${LATEST_REVIEW}
            WHERE h.id = @id
        `);
    return result.recordset[0] ?? null;
}
