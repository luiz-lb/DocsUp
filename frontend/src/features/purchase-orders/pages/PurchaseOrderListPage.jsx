import { PageHeader, DataTable, StatusBadge } from '../../../components/ui/index.js';
import { PURCHASE_ORDER_STATUS } from '../../../constants/enums.js';
import { formatCurrency } from '../../../utils/formatters.js';
import { useAsyncData } from '../../../hooks/useAsyncData.js';
import { listPurchaseOrders } from '../api/purchaseOrdersApi.js';

const COLUMNS = [
  { key: 'poNumber', header: 'Pedido de compra' },
  { key: 'supplierName', header: 'Fornecedor' },
  { key: 'laborRequestTitle', header: 'Solicitacao vinculada' },
  { key: 'poValue', header: 'Valor', render: (row) => formatCurrency(row.poValue) },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge enumMap={PURCHASE_ORDER_STATUS} value={row.status} /> },
];

export default function PurchaseOrderListPage() {
  const { data: orders, isLoading } = useAsyncData(listPurchaseOrders, []);

  return (
    <div>
      <PageHeader
        eyebrow="Fiscal & Financeiro"
        title="Pedidos de compra"
        description="Pedidos lancados no GOEVO e vinculados a solicitacao de mao de obra de origem."
      />
      <DataTable columns={COLUMNS} rows={orders ?? []} isLoading={isLoading} emptyTitle="Nenhum pedido de compra lancado" />
    </div>
  );
}
