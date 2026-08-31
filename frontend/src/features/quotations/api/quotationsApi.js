import { mockDelay } from '../../../hooks/useMockApi.js';
import { getLaborRequest } from '../../labor-requests/api/laborRequestsApi.js';

const rounds = [
  { id: 501, laborRequestId: 101, roundNumber: 1, status: 0, deadline: '2026-08-12T18:00:00Z' },
];

const invites = [
  { id: 1, roundId: 501, supplierId: 1, supplierName: 'Eletro Instala', token: 'demo-token', status: 2 },
  { id: 2, roundId: 501, supplierId: 2, supplierName: 'Solda Forte', token: 'tok-2', status: 0 },
];

const quotations = [
  {
    id: 5001,
    roundId: 501,
    supplierId: 1,
    supplierName: 'Eletro Instala',
    totalValue: 184500,
    status: 1,
    nrDeclarations: [{ nrTypeId: 10, employeeCount: 3 }, { nrTypeId: 12, employeeCount: 2 }],
    checklist: [{ documentTypeId: 4, hasDocument: true }, { documentTypeId: 5, hasDocument: true }],
    checklistAccepted: true,
    omissionWarningAccepted: true,
    acceptanceIp: '187.10.20.5',
    acceptanceAt: '2026-08-04T09:32:00Z',
    submittedAt: '2026-08-04T09:32:00Z',
  },
];

export function getQuotationRound(roundId) {
  const round = rounds.find((item) => item.id === Number(roundId));
  if (!round) return mockDelay(null);

  const roundQuotations = quotations
    .filter((quotation) => quotation.roundId === round.id)
    .sort((a, b) => a.totalValue - b.totalValue);

  return mockDelay({ ...round, quotations: roundQuotations });
}

export async function getInviteByToken(token) {
  const invite = invites.find((item) => item.token === token) ?? invites[0];
  const round = rounds.find((item) => item.id === invite.roundId);
  const laborRequest = await getLaborRequest(round.laborRequestId);
  const existingQuotation = quotations.find(
    (quotation) => quotation.roundId === round.id && quotation.supplierId === invite.supplierId,
  );

  return mockDelay({ invite, round, laborRequest, existingQuotation: existingQuotation ?? null }, 400);
}

export function submitQuotation(token, payload) {
  const invite = invites.find((item) => item.token === token) ?? invites[0];
  invite.status = 2;
  invite.respondedAt = new Date().toISOString();

  const record = {
    id: Math.max(0, ...quotations.map((quotation) => quotation.id)) + 1,
    roundId: invite.roundId,
    supplierId: invite.supplierId,
    supplierName: invite.supplierName,
    status: 1,
    submittedAt: new Date().toISOString(),
    acceptanceIp: '203.0.113.42',
    acceptanceAt: new Date().toISOString(),
    ...payload,
  };
  quotations.push(record);
  return mockDelay(record, 600);
}

export function declareWinner(roundId, winnerQuotationId) {
  const round = rounds.find((item) => item.id === Number(roundId));
  if (round) round.status = 1;

  quotations
    .filter((quotation) => quotation.roundId === Number(roundId))
    .forEach((quotation) => {
      quotation.status = quotation.id === winnerQuotationId ? 2 : 3;
    });

  return mockDelay({ phase2DeadlineHours: 72 }, 500);
}
