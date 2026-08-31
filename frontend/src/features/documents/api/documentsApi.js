import { mockDelay } from '../../../hooks/useMockApi.js';

const documents = [
  {
    id: 9001,
    supplierId: 1,
    supplierName: 'Eletro Instala',
    documentTypeId: 5,
    documentTypeName: 'APR - Analise Preliminar de Risco',
    fileName: 'APR_EletroInstala_2026.pdf',
    status: 1,
    validationType: 1,
    aiScore: 92,
    aiChecklist: [
      { point: 'Identificacao da atividade e local', score: 95 },
      { point: 'Riscos mapeados compativeis com NR-10/NR-12', score: 90 },
      { point: 'Assinatura do responsavel tecnico', score: 90 },
    ],
    finalStatus: 1,
  },
  {
    id: 9002,
    supplierId: 1,
    supplierName: 'Eletro Instala',
    documentTypeId: 4,
    documentTypeName: 'PGR - Programa de Gerenciamento de Riscos',
    fileName: 'PGR_EletroInstala_2026.pdf',
    status: 1,
    validationType: 1,
    aiScore: 71,
    aiChecklist: [
      { point: 'Inventario de riscos por funcao', score: 80 },
      { point: 'Cronograma de acoes preventivas', score: 55 },
      { point: 'Validade dentro do prazo', score: 78 },
    ],
    finalStatus: 0,
  },
  {
    id: 9003,
    supplierId: 2,
    supplierName: 'Solda Forte',
    documentTypeId: 3,
    documentTypeName: 'Regularidade FGTS (CRF)',
    fileName: 'CRF_SoldaForte.pdf',
    status: 2,
    validationType: 0,
    aiScore: null,
    aiChecklist: [],
    finalStatus: 1,
  },
  {
    id: 9004,
    supplierId: 2,
    supplierName: 'Solda Forte',
    documentTypeId: 6,
    documentTypeName: 'CIPA - Ata de Constituicao',
    fileName: 'CIPA_SoldaForte.pdf',
    status: 1,
    validationType: 1,
    aiScore: 58,
    aiChecklist: [
      { point: 'Ata assinada por todos os membros', score: 40 },
      { point: 'Vigencia do mandato valida', score: 70 },
      { point: 'Representantes do empregador e empregados', score: 65 },
    ],
    finalStatus: 0,
  },
];

export function listDocuments() {
  return mockDelay([...documents]);
}

export function listReviewQueue() {
  return mockDelay(documents.filter((doc) => doc.finalStatus === 0));
}

export function reviewDocument(documentId, decision, comments) {
  const doc = documents.find((item) => item.id === Number(documentId));
  if (!doc) return mockDelay(null);

  doc.finalStatus = decision;
  doc.status = decision === 1 ? 2 : 4;
  doc.manualComments = comments;
  return mockDelay(doc, 400);
}
