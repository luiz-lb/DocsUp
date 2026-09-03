import { sql, poolPromise } from '../config/dbConfig.js';

// ─────────────────────────────────────────────
// Leitura de documentos
// ─────────────────────────────────────────────

/**
 * Lista todos os documentos com seu status de validação mais recente.
 * Usado pela Central de Documentos (painel interno).
 */
export async function listDocumentsWithValidation({ supplierId, laborRequestId, status } = {}) {
    const pool = await poolPromise;

    let where = 'd.is_current = 1';
    const request = pool.request();

    if (supplierId) {
        where += ' AND d.supplier_id = @supplier_id';
        request.input('supplier_id', sql.Int, supplierId);
    }
    if (laborRequestId) {
        where += ' AND d.labor_request_id = @labor_request_id';
        request.input('labor_request_id', sql.Int, laborRequestId);
    }
    if (status !== undefined && status !== null) {
        where += ' AND d.[status] = @doc_status';
        request.input('doc_status', sql.TinyInt, status);
    }

    const result = await request.query(`
        SELECT
            d.id,
            d.uid,
            d.supplier_id,
            s.razao_social       AS supplier_name,
            d.document_type_id,
            dt.[name]            AS document_type_name,
            dt.scope,
            dt.validation_method,
            d.employee_id,
            e.full_name          AS employee_name,
            d.file_name,
            d.file_path,
            d.file_size_bytes,
            d.mime_type,
            d.[status],
            d.expires_at,
            d.uploaded_at,
            d.labor_request_id,
            /* Última validação */
            dv.id                AS validation_id,
            dv.validation_type,
            dv.ai_score,
            dv.final_status,
            dv.manual_decision,
            dv.manual_comments,
            dv.reviewed_at
        FROM documents AS d
        INNER JOIN suppliers     AS s  ON s.id  = d.supplier_id
        INNER JOIN document_types AS dt ON dt.id = d.document_type_id
        LEFT  JOIN employees     AS e  ON e.id  = d.employee_id
        OUTER APPLY (
            SELECT TOP 1 *
            FROM document_validations
            WHERE document_id = d.id
            ORDER BY created_at DESC
        ) AS dv
        WHERE ${where}
        ORDER BY d.uploaded_at DESC
    `);

    return result.recordset;
}

/**
 * Lista documentos na fila de revisão manual (final_status = 0 = Pendente).
 */
export async function listReviewQueue() {
    const pool = await poolPromise;
    const result = await pool.request()
        .query(`
            SELECT
                d.id,
                d.uid,
                d.supplier_id,
                s.razao_social  AS supplier_name,
                d.document_type_id,
                dt.[name]       AS document_type_name,
                dt.scope,
                d.file_name,
                d.file_path,
                dv.id           AS validation_id,
                dv.ai_score,
                dv.ai_result_json,
                dv.ai_model_used,
                dv.api_response,
                dv.api_valid,
                dv.validation_type,
                dv.final_status
            FROM document_validations AS dv
            INNER JOIN documents      AS d  ON d.id  = dv.document_id
            INNER JOIN suppliers      AS s  ON s.id  = d.supplier_id
            INNER JOIN document_types AS dt ON dt.id = d.document_type_id
            WHERE dv.final_status = 0   -- Pendente de revisão
              AND d.is_current    = 1
            ORDER BY dv.created_at ASC
        `);
    return result.recordset;
}

// ─────────────────────────────────────────────
// Inserir / atualizar validações
// ─────────────────────────────────────────────

/**
 * Insere um registro de validação (API pública ou IA).
 */
export async function insertValidation(transaction, {
    documentId, validationType, aiScore, aiResultJson, aiModelUsed,
    apiResponse, apiValid, finalStatus
}) {
    const request = new sql.Request(transaction);
    const result = await request
        .input('document_id', sql.Int, documentId)
        .input('validation_type', sql.TinyInt, validationType)
        .input('ai_score', sql.Decimal(5, 2), aiScore ?? null)
        .input('ai_result_json', sql.NVarChar(sql.MAX), aiResultJson ?? null)
        .input('ai_model_used', sql.VarChar(100), aiModelUsed ?? null)
        .input('api_response', sql.NVarChar(sql.MAX), apiResponse ?? null)
        .input('api_valid', sql.Bit, apiValid !== null && apiValid !== undefined ? (apiValid ? 1 : 0) : null)
        .input('final_status', sql.TinyInt, finalStatus)
        .query(`
            INSERT INTO document_validations
                (document_id, validation_type, ai_score, ai_result_json, ai_model_used,
                 api_response, api_valid, final_status)
            OUTPUT INSERTED.id
            VALUES
                (@document_id, @validation_type, @ai_score, @ai_result_json, @ai_model_used,
                 @api_response, @api_valid, @final_status)
        `);
    return result.recordset[0]?.id ?? null;
}

/**
 * Registra a decisão manual de revisão (RH / Segurança do Trabalho).
 */
export async function applyManualDecision(transaction, validationId, reviewerId, decision, comments) {
    const request = new sql.Request(transaction);
    await request
        .input('id', sql.Int, validationId)
        .input('reviewer_id', sql.Int, reviewerId)
        .input('decision', sql.TinyInt, decision)
        .input('comments', sql.NVarChar(sql.MAX), comments ?? null)
        .query(`
            UPDATE document_validations
            SET manual_decision   = @decision,
                manual_comments   = @comments,
                reviewer_id       = @reviewer_id,
                reviewed_at       = GETDATE(),
                final_status      = @decision   -- espelha: 1=Aprovado, 2=Reprovado
            WHERE id = @id
        `);
}

/**
 * Atualiza o status de um documento (tabela documents).
 * status: 0=Pendente, 1=Validando, 2=Aprovado, 3=Reprovado, 4=Reenvio Necessário, 5=Expirado
 */
export async function updateDocumentStatus(transaction, documentId, status) {
    const request = new sql.Request(transaction);
    await request
        .input('id', sql.Int, documentId)
        .input('status', sql.TinyInt, status)
        .query(`
            UPDATE documents
            SET [status]   = @status,
                updated_at = GETDATE()
            WHERE id = @id
        `);
}

/**
 * Busca um documento por ID com o tipo de validação.
 */
export async function getDocumentById(documentId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, documentId)
        .query(`
            SELECT
                d.id, d.supplier_id, d.document_type_id,
                dt.validation_method, dt.[name] AS document_type_name,
                dt.api_endpoint, dt.required_fields,
                d.file_path, d.file_name, d.mime_type
            FROM documents AS d
            INNER JOIN document_types AS dt ON dt.id = d.document_type_id
            WHERE d.id = @id
        `);
    return result.recordset[0] ?? null;
}
