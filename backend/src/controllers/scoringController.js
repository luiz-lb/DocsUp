import * as scoringService from '../services/scoringService.js';

const EVALUATOR_ROLE_BY_DEPARTMENT = { 0: 0, 2: 1, 5: 2 }; // RH=0, Suprimentos=1, Obra=2

/** GET /scoring/scoreboard */
export async function listScoreboard(req, res) {
    try {
        const result = await scoringService.listScoreboard();
        if (!result.success) {
            return res.status(500).json({ success: false, body: { message: result.message } });
        }
        return res.status(200).json({ success: true, body: result.body });
    } catch (error) {
        console.error('listScoreboard controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/** GET /scoring/breakdown/:supplierId/:laborRequestId */
export async function getScoreBreakdown(req, res) {
    try {
        const { supplierId, laborRequestId } = req.params;
        const result = await scoringService.getScoreBreakdown(Number(supplierId), Number(laborRequestId));
        if (!result.success) {
            return res.status(500).json({ success: false, body: { message: result.message } });
        }
        return res.status(200).json({ success: true, body: result.body });
    } catch (error) {
        console.error('getScoreBreakdown controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}

/**
 * POST /scoring/evaluate
 * Body: { supplierId, laborRequestId, score, comments }
 */
export async function submitEvaluation(req, res) {
    try {
        const { supplierId, laborRequestId, score, comments } = req.body;
        const evaluatorId = req.usuario.id;
        const evaluatorRole = EVALUATOR_ROLE_BY_DEPARTMENT[req.usuario.department] ?? 0;

        if (!supplierId || !laborRequestId || score === undefined) {
            return res.status(400).json({
                success: false,
                body: { message: 'supplierId, laborRequestId e score são obrigatórios.' },
            });
        }

        const result = await scoringService.submitEvaluation({
            supplierId: Number(supplierId),
            laborRequestId: Number(laborRequestId),
            evaluatorId,
            evaluatorRole,
            score: Number(score),
            comments,
        });

        if (!result.success) {
            return res.status(400).json({ success: false, body: { message: result.message } });
        }

        return res.status(201).json({ success: true, body: result.body });
    } catch (error) {
        console.error('submitEvaluation controller error:', error);
        return res.status(500).json({ success: false, body: { message: 'Erro interno do servidor.' } });
    }
}
