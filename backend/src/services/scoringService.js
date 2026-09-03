import * as scoringModel from '../models/scoringModel.js';
import * as trasaction from '../models/trasaction.js';

// Pesos da média ponderada (conforme especificação)
const WEIGHTS = { quotation: 1, documentation: 3, evaluation: 5 };

// ─────────────────────────────────────────────
// Cálculo de score
// ─────────────────────────────────────────────

/**
 * Calcula o score final de um fornecedor para uma solicitação.
 * Score final = média ponderada − penalidades de prazo (phase2 estourado)
 *
 * @param {{ quotationDeliveryScore, documentationScore, evaluationScore, deadlinePenalty }} scores
 */
function computeFinalScore({ quotationDeliveryScore, documentationScore, evaluationScore, deadlinePenalty = 0 }) {
    const totalWeight = WEIGHTS.quotation + WEIGHTS.documentation + WEIGHTS.evaluation;
    const weighted =
        (quotationDeliveryScore ?? 0) * WEIGHTS.quotation +
        (documentationScore ?? 0)    * WEIGHTS.documentation +
        (evaluationScore ?? 0)       * WEIGHTS.evaluation;
    const raw = weighted / totalWeight;
    return Math.max(0, Number((raw - deadlinePenalty).toFixed(2)));
}

/**
 * Calcula o score de entrega da cotação com base nos dias entre a criação do round e a submissão.
 * Faixa: 1-7 dias=10pts, 7-14 dias=7pts, 14-16 dias=5pts, >16 dias=3pts
 */
function computeQuotationDeliveryScore(deliveryDays) {
    if (!deliveryDays || deliveryDays <= 0) return 10;
    if (deliveryDays <= 7)  return 10;
    if (deliveryDays <= 14) return 7;
    if (deliveryDays <= 16) return 5;
    return 3;
}

/**
 * Calcula o score de documentação com base no número de retrabalhos.
 * Base 10pts − 0,5pts por documento reenviado.
 */
function computeDocumentationScore(reworkCount = 0) {
    return Math.max(0, Number((10 - reworkCount * 0.5).toFixed(2)));
}

// ─────────────────────────────────────────────
// Recalcular score completo de um fornecedor / solicitação
// ─────────────────────────────────────────────

/**
 * Recalcula e persiste o score de um fornecedor para uma solicitação.
 * Chamado após:
 *  - Phase 2 expirar (penalidade de prazo)
 *  - Reenvio de documento (incrementa reworkCount)
 *  - Submissão de avaliação manual
 *
 * @param {{ supplierId, laborRequestId, quotationDeliveryDays?, reworkCount?, deadlinePenalty? }} params
 */
export async function recalculateScore(params) {
    const {
        supplierId, laborRequestId,
        quotationDeliveryDays,
        reworkCount = 0,
        deadlinePenalty = 0,
    } = params;

    // Busca avaliações humanas para calcular evaluationScore
    const evaluations = await scoringModel.getEvaluationsBySupplierAndRequest(supplierId, laborRequestId);
    const evaluationScore = evaluations.length > 0
        ? Number((evaluations.reduce((s, e) => s + Number(e.score), 0) / evaluations.length).toFixed(2))
        : null;

    const quotationDeliveryScore = quotationDeliveryDays != null
        ? computeQuotationDeliveryScore(quotationDeliveryDays)
        : null;

    const reworkPenalty = reworkCount * 0.5;
    const documentationScore = computeDocumentationScore(reworkCount);

    const finalScore = computeFinalScore({
        quotationDeliveryScore: quotationDeliveryScore ?? 0,
        documentationScore,
        evaluationScore: evaluationScore ?? 0,
        deadlinePenalty,
    });

    let transaction;
    let transactionDone = false;

    try {
        transaction = await trasaction.iniciarTransacao();

        await scoringModel.upsertScore(transaction, {
            supplierId,
            laborRequestId,
            quotationDeliveryScore,
            quotationDeliveryDays,
            documentationScore,
            reworkCount,
            reworkPenalty,
            evaluationScore,
            weightQuotation: WEIGHTS.quotation,
            weightDocumentation: WEIGHTS.documentation,
            weightEvaluation: WEIGHTS.evaluation,
            finalScore,
            deadlinePenalty,
        });

        // Atualiza overall_score do fornecedor (média de todos os scores)
        await scoringModel.updateSupplierOverallScore(transaction, supplierId);

        await trasaction.finalizarTransacao(transaction, true);
        transactionDone = true;

        return { success: true, body: { finalScore } };
    } catch (error) {
        if (transaction && !transactionDone) {
            await trasaction.finalizarTransacao(transaction, false);
        }
        console.error('recalculateScore error:', error);
        return { success: false, message: 'Erro ao calcular score.' };
    }
}

// ─────────────────────────────────────────────
// Submeter avaliação humana
// ─────────────────────────────────────────────

/**
 * Salva uma avaliação e recalcula o score final do fornecedor.
 */
export async function submitEvaluation({ supplierId, laborRequestId, evaluatorId, evaluatorRole, score, comments }) {
    if (score < 0 || score > 10) {
        return { success: false, message: 'O score deve ser entre 0 e 10.' };
    }

    let transaction;
    let transactionDone = false;

    try {
        transaction = await trasaction.iniciarTransacao();

        await scoringModel.insertEvaluation(transaction, {
            supplierId, laborRequestId, evaluatorId, evaluatorRole,
            score: Number(score), comments,
        });

        await trasaction.finalizarTransacao(transaction, true);
        transactionDone = true;

        // Recalcula o score após a nova avaliação
        const existingScore = await scoringModel.getScoreBySupplierAndRequest(supplierId, laborRequestId);
        await recalculateScore({
            supplierId,
            laborRequestId,
            quotationDeliveryDays: existingScore?.quotation_delivery_days ?? null,
            reworkCount: existingScore?.rework_count ?? 0,
            deadlinePenalty: existingScore?.deadline_penalty ?? 0,
        });

        return { success: true, body: { message: 'Avaliação registrada e score recalculado.' } };
    } catch (error) {
        if (transaction && !transactionDone) {
            await trasaction.finalizarTransacao(transaction, false);
        }
        console.error('submitEvaluation error:', error);
        return { success: false, message: 'Erro ao salvar avaliação.' };
    }
}

// ─────────────────────────────────────────────
// Listagens
// ─────────────────────────────────────────────

export async function listScoreboard() {
    try {
        const scores = await scoringModel.listScoreboard();
        return { success: true, body: { scores } };
    } catch (error) {
        console.error('listScoreboard error:', error);
        return { success: false, message: 'Erro ao listar scoreboard.' };
    }
}

export async function getScoreBreakdown(supplierId, laborRequestId) {
    try {
        const score = await scoringModel.getScoreBySupplierAndRequest(supplierId, laborRequestId);
        const evaluations = await scoringModel.getEvaluationsBySupplierAndRequest(supplierId, laborRequestId);
        return { success: true, body: { score, evaluations } };
    } catch (error) {
        console.error('getScoreBreakdown error:', error);
        return { success: false, message: 'Erro ao buscar breakdown do score.' };
    }
}
