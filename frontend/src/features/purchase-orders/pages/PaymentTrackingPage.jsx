import { useState } from 'react';
import { PageHeader, DataTable, StatusBadge, EmptyState } from '../../../components/ui/index.js';
import { INVOICE_STATUS } from '../../../constants/enums.js';
import { formatCurrency } from '../../../utils/formatters.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { listInvoicesWithBlocks, resolvePaymentBlock } from '../api/purchaseOrdersApi.js';
import PaymentBlockBanner from '../components/PaymentBlockBanner/index.js';
import styles from './PaymentTrackingPage.module.css';

const COLUMNS = [
  { key: 'nfNumber', header: 'NF' },
  { key: 'poNumber', header: 'Pedido de compra' },
  { key: 'supplierName', header: 'Fornecedor' },
  { key: 'nfValue', header: 'Valor', render: (row) => formatCurrency(row.nfValue) },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge enumMap={INVOICE_STATUS} value={row.status} /> },
];

export default function PaymentTrackingPage() {
  const { data, isLoading, reload } = useAsyncData(listInvoicesWithBlocks, []);
  const [resolvingId, setResolvingId] = useState(null);

  if (isLoading || !data) return null;

  const activeBlocks = data.paymentBlocks.filter((block) => block.status === 0);

  const handleResolve = async (blockId) => {
    setResolvingId(blockId);
    await resolvePaymentBlock(blockId);
    setResolvingId(null);
    reload();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Fiscal & Financeiro"
        title="Acompanhamento de pagamentos"
        description="Cruzamento entre notas fiscais recebidas na pasta do fiscal e a documentacao pendente do fornecedor."
      />

      {activeBlocks.length === 0 ? (
        <div className={styles.blocksSpacer}>
          <EmptyState title="Nenhum pagamento travado" description="Todos os fornecedores estao com a documentacao em dia." />
        </div>
      ) : (
        <div className={styles.blocks}>
          {activeBlocks.map((block) => (
            <PaymentBlockBanner key={block.id} block={block} onResolve={handleResolve} isResolving={resolvingId === block.id} />
          ))}
        </div>
      )}

      <DataTable columns={COLUMNS} rows={data.invoices} emptyTitle="Nenhuma nota fiscal recebida" />
    </div>
  );
}
