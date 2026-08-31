import { mockDelay } from '../../../hooks/useMockApi.js';

const purchaseOrders = [
  {
    id: 1,
    poNumber: 'PC-58421',
    supplierName: 'Eletro Instala',
    laborRequestTitle: 'Equipe de instalacao eletrica - Torre B',
    poValue: 184500,
    status: 1,
  },
  {
    id: 2,
    poNumber: 'PC-58502',
    supplierName: 'Limpa Obra',
    laborRequestTitle: 'Limpeza pos-obra - Bloco A',
    poValue: 32000,
    status: 4,
  },
];

const invoices = [
  {
    id: 1,
    purchaseOrderId: 1,
    poNumber: 'PC-58421',
    supplierName: 'Eletro Instala',
    nfNumber: '000123',
    nfValue: 184500,
    status: 2,
    denialReason: 'PGR pendente de revisao manual (score de IA abaixo do limite).',
  },
  {
    id: 2,
    purchaseOrderId: 2,
    poNumber: 'PC-58502',
    supplierName: 'Limpa Obra',
    nfNumber: '000045',
    nfValue: 32000,
    status: 4,
  },
];

const paymentBlocks = [
  {
    id: 1,
    supplierName: 'Eletro Instala',
    purchaseOrderId: 1,
    poNumber: 'PC-58421',
    blockReason: 0,
    docDeadline: '2026-08-09',
    status: 0,
  },
];

export function listPurchaseOrders() {
  return mockDelay([...purchaseOrders]);
}

export function listInvoicesWithBlocks() {
  return mockDelay({
    invoices: [...invoices],
    paymentBlocks: [...paymentBlocks],
  });
}

export function resolvePaymentBlock(blockId) {
  const block = paymentBlocks.find((item) => item.id === Number(blockId));
  if (block) block.status = 1;
  return mockDelay(block, 400);
}
