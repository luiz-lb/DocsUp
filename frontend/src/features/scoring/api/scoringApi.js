import { mockDelay } from '../../../hooks/useMockApi.js';

const WEIGHTS = { quotation: 1, documentation: 3, evaluation: 5 };

function computeFinalScore(record) {
  const totalWeight = WEIGHTS.quotation + WEIGHTS.documentation + WEIGHTS.evaluation;
  const weighted =
    record.quotationDeliveryScore * WEIGHTS.quotation +
    record.documentationScore * WEIGHTS.documentation +
    record.evaluationScore * WEIGHTS.evaluation;
  return Number((weighted / totalWeight).toFixed(2));
}

const scores = [
  {
    id: 1,
    supplierId: 1,
    supplierName: 'Eletro Instala',
    laborRequestId: 101,
    quotationDeliveryScore: 9,
    documentationScore: 8.5,
    reworkCount: 0,
    evaluationScore: 8.7,
  },
  {
    id: 2,
    supplierId: 2,
    supplierName: 'Solda Forte',
    laborRequestId: 101,
    quotationDeliveryScore: 6,
    documentationScore: 5.5,
    reworkCount: 2,
    evaluationScore: 6.2,
  },
].map((record) => ({ ...record, weights: WEIGHTS, finalScore: computeFinalScore(record) }));

const evaluations = [
  { id: 1, supplierId: 1, laborRequestId: 101, evaluatorRole: 0, score: 9, comments: 'Documentacao impecavel.' },
  { id: 2, supplierId: 1, laborRequestId: 101, evaluatorRole: 1, score: 8.5, comments: 'Entrega dentro do prazo.' },
  { id: 3, supplierId: 1, laborRequestId: 101, evaluatorRole: 2, score: 8.6, comments: 'Equipe bem treinada em campo.' },
];

export function listScoreboard() {
  return mockDelay([...scores].sort((a, b) => b.finalScore - a.finalScore));
}

export function getScoreBreakdown(supplierId, laborRequestId) {
  const score = scores.find(
    (item) => item.supplierId === Number(supplierId) && item.laborRequestId === Number(laborRequestId),
  );
  const relatedEvaluations = evaluations.filter(
    (item) => item.supplierId === Number(supplierId) && item.laborRequestId === Number(laborRequestId),
  );
  return mockDelay({ score, evaluations: relatedEvaluations });
}

export function submitEvaluation(supplierId, laborRequestId, evaluatorRole, score, comments) {
  evaluations.push({
    id: evaluations.length + 1,
    supplierId: Number(supplierId),
    laborRequestId: Number(laborRequestId),
    evaluatorRole,
    score,
    comments,
  });

  const record = scores.find(
    (item) => item.supplierId === Number(supplierId) && item.laborRequestId === Number(laborRequestId),
  );
  if (record) {
    const related = evaluations.filter(
      (item) => item.supplierId === Number(supplierId) && item.laborRequestId === Number(laborRequestId),
    );
    record.evaluationScore = Number((related.reduce((sum, item) => sum + item.score, 0) / related.length).toFixed(2));
    record.finalScore = computeFinalScore(record);
  }

  return mockDelay(record, 400);
}
