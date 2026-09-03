import { sql, poolPromise } from '../config/dbConfig.js';

// ─────────────────────────────────────────────
// Supplier Scores
// ─────────────────────────────────────────────

/**
 * Busca o score de um fornecedor em uma solicitação.
 */
export async function getScoreBySupplierAndRequest(supplierId, laborRequestId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('supplier_id', sql.Int, supplierId)
        .input('labor_request_id', sql.Int, laborRequestId)
        .query(`
            SELECT
                ss.*,
                s.razao_social AS supplier_name,
                lr.title       AS labor_request_title
            FROM supplier_scores AS ss
            INNER JOIN suppliers      AS s  ON s.id  = ss.supplier_id
            INNER JOIN labor_requests AS lr ON lr.id = ss.labor_request_id
            WHERE ss.supplier_id      = @supplier_id
              AND ss.labor_request_id = @labor_request_id
        `);
    return result.recordset[0] ?? null;
}

/**
 * Lista o scoreboard: todos os fornecedores com seus scores mais recentes.
 * Agrupa por fornecedor pegando o score final calculado mais recentemente.
 */
export async function listScoreboard() {
    const pool = await poolPromise;
    const result = await pool.request()
        .query(`
            SELECT
                ss.id,
                ss.supplier_id,
                s.razao_social               AS supplier_name,
                s.nome_fantasia,
                s.overall_score,
                ss.labor_request_id,
                lr.title                     AS labor_request_title,
                ss.quotation_delivery_score,
                ss.quotation_delivery_days,
                ss.documentation_score,
                ss.rework_count,
                ss.rework_penalty,
                ss.evaluation_score,
                ss.weight_quotation,
                ss.weight_documentation,
                ss.weight_evaluation,
                ss.final_score,
                ss.deadline_penalty,
                ss.calculated_at
            FROM supplier_scores AS ss
            INNER JOIN suppliers      AS s  ON s.id  = ss.supplier_id
            INNER JOIN labor_requests AS lr ON lr.id = ss.labor_request_id
            ORDER BY ss.final_score DESC
        `);
    return result.recordset;
}

/**
 * Upsert do score: cria ou atualiza para o par (supplier_id, labor_request_id).
 */
export async function upsertScore(transaction, {
    supplierId, laborRequestId,
    quotationDeliveryScore, quotationDeliveryDays,
    documentationScore, reworkCount, reworkPenalty,
    evaluationScore,
    weightQuotation, weightDocumentation, weightEvaluation,
    finalScore, deadlinePenalty,
}) {
    const request = new sql.Request(transaction);
    await request
        .input('supplier_id', sql.Int, supplierId)
        .input('labor_request_id', sql.Int, laborRequestId)
        .input('quotation_delivery_score', sql.Decimal(4, 2), quotationDeliveryScore ?? null)
        .input('quotation_delivery_days', sql.Int, quotationDeliveryDays ?? null)
        .input('documentation_score', sql.Decimal(4, 2), documentationScore ?? null)
        .input('rework_count', sql.Int, reworkCount ?? 0)
        .input('rework_penalty', sql.Decimal(4, 2), reworkPenalty ?? 0)
        .input('evaluation_score', sql.Decimal(4, 2), evaluationScore ?? null)
        .input('weight_quotation', sql.Decimal(3, 1), weightQuotation ?? 1)
        .input('weight_documentation', sql.Decimal(3, 1), weightDocumentation ?? 3)
        .input('weight_evaluation', sql.Decimal(3, 1), weightEvaluation ?? 5)
        .input('final_score', sql.Decimal(5, 2), finalScore ?? null)
        .input('deadline_penalty', sql.Decimal(4, 2), deadlinePenalty ?? 0)
        .query(`
            IF EXISTS (
                SELECT 1 FROM supplier_scores
                WHERE supplier_id = @supplier_id AND labor_request_id = @labor_request_id
            )
                UPDATE supplier_scores
                SET quotation_delivery_score = @quotation_delivery_score,
                    quotation_delivery_days  = @quotation_delivery_days,
                    documentation_score      = @documentation_score,
                    rework_count             = @rework_count,
                    rework_penalty           = @rework_penalty,
                    evaluation_score         = @evaluation_score,
                    weight_quotation         = @weight_quotation,
                    weight_documentation     = @weight_documentation,
                    weight_evaluation        = @weight_evaluation,
                    final_score              = @final_score,
                    deadline_penalty         = @deadline_penalty,
                    calculated_at            = GETDATE()
                WHERE supplier_id = @supplier_id AND labor_request_id = @labor_request_id
            ELSE
                INSERT INTO supplier_scores
                    (supplier_id, labor_request_id,
                     quotation_delivery_score, quotation_delivery_days,
                     documentation_score, rework_count, rework_penalty,
                     evaluation_score, weight_quotation, weight_documentation, weight_evaluation,
                     final_score, deadline_penalty)
                VALUES
                    (@supplier_id, @labor_request_id,
                     @quotation_delivery_score, @quotation_delivery_days,
                     @documentation_score, @rework_count, @rework_penalty,
                     @evaluation_score, @weight_quotation, @weight_documentation, @weight_evaluation,
                     @final_score, @deadline_penalty)
        `);
}

/**
 * Atualiza o overall_score do fornecedor (média de todos os finais scores).
 */
export async function updateSupplierOverallScore(transaction, supplierId) {
    const request = new sql.Request(transaction);
    await request
        .input('supplier_id', sql.Int, supplierId)
        .query(`
            UPDATE suppliers
            SET overall_score = (
                SELECT AVG(final_score)
                FROM supplier_scores
                WHERE supplier_id = @supplier_id
                  AND final_score IS NOT NULL
            )
            WHERE id = @supplier_id
        `);
}

// ─────────────────────────────────────────────
// Supplier Evaluations
// ─────────────────────────────────────────────

/**
 * Insere uma avaliação humana (RH=0, Suprimentos=1, Chefe de Obra=2).
 */
export async function insertEvaluation(transaction, {
    supplierId, laborRequestId, evaluatorId, evaluatorRole, score, comments
}) {
    const request = new sql.Request(transaction);
    await request
        .input('supplier_id', sql.Int, supplierId)
        .input('labor_request_id', sql.Int, laborRequestId)
        .input('evaluator_id', sql.Int, evaluatorId)
        .input('evaluator_role', sql.TinyInt, evaluatorRole)
        .input('score', sql.Decimal(4, 2), score)
        .input('comments', sql.NVarChar(sql.MAX), comments ?? null)
        .query(`
            INSERT INTO supplier_evaluations
                (supplier_id, labor_request_id, evaluator_id, evaluator_role, score, comments)
            VALUES
                (@supplier_id, @labor_request_id, @evaluator_id, @evaluator_role, @score, @comments)
        `);
}

/**
 * Busca avaliações de um fornecedor em uma solicitação.
 */
export async function getEvaluationsBySupplierAndRequest(supplierId, laborRequestId) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('supplier_id', sql.Int, supplierId)
        .input('labor_request_id', sql.Int, laborRequestId)
        .query(`
            SELECT
                se.id,
                se.evaluator_id,
                u.[name]    AS evaluator_name,
                se.evaluator_role,
                se.score,
                se.comments,
                se.evaluated_at
            FROM supplier_evaluations AS se
            LEFT JOIN users AS u ON u.id = se.evaluator_id
            WHERE se.supplier_id      = @supplier_id
              AND se.labor_request_id = @labor_request_id
            ORDER BY se.evaluated_at DESC
        `);
    return result.recordset;
}
