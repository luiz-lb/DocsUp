import Banner from '../../../../components/ui/Banner/index.js';
import Button from '../../../../components/ui/Button/index.js';
import { PAYMENT_BLOCK_REASON } from '../../../../constants/enums.js';
import { formatDate } from '../../../../utils/formatters.js';

/**
 * Alerta de pagamento travado: nasce do monitor da pasta do fiscal (NF x PC)
 * cruzado com a documentacao pendente do fornecedor.
 */
export default function PaymentBlockBanner({ block, onResolve, isResolving }) {
  return (
    <Banner
      tone="danger"
      title={`${block.supplierName} — ${PAYMENT_BLOCK_REASON[block.blockReason].label}`}
      description={`Pedido ${block.poNumber} bloqueado. Prazo para regularizar: ${formatDate(block.docDeadline)}. Apos essa data o pagamento pode ser cancelado e o contrato reaberto para outro fornecedor.`}
      actions={
        <Button size="sm" variant="secondary" onClick={() => onResolve(block.id)} isLoading={isResolving}>
          Marcar como regularizado
        </Button>
      }
    />
  );
}
