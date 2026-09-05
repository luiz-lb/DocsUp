import { Modal } from '../../../../components/ui/index.js';
import { StatusBadge } from '../../../../components/ui/index.js';
import { QUOTATION_STATUS } from '../../../../constants/enums.js';
import { formatCurrency, formatDateTime } from '../../../../utils/formatters.js';
import styles from './QuotationDetailModal.module.css';

/**
 * Modal de detalhe de uma cotação enviada pelo fornecedor.
 *
 * Props:
 *  - open   : boolean
 *  - onClose: () => void
 *  - row    : objeto com campos q_* e supplier_name vindos do JOIN do backend
 */
export default function QuotationDetailModal({ open, onClose, row }) {
  if (!row) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Cotação — ${row.supplier_name ?? row.i_invite_email ?? '—'}`}
      maxWidth="sm"
    >
      <dl className={styles.grid}>
        <dt>Fornecedor</dt>
        <dd>{row.supplier_name ?? row.i_invite_email ?? '—'}</dd>

        <dt>Valor proposto</dt>
        <dd className={styles.value}>
          {row.q_total_value != null ? formatCurrency(row.q_total_value) : '—'}
        </dd>

        <dt>Status da cotação</dt>
        <dd>
          {row.q_status != null ? (
            <StatusBadge enumMap={QUOTATION_STATUS} value={row.q_status} />
          ) : '—'}
        </dd>

        <dt>Enviada em</dt>
        <dd>{row.q_submitted_at ? formatDateTime(row.q_submitted_at) : '—'}</dd>

        <dt>Aceite digital (IP)</dt>
        <dd>{row.q_acceptance_ip ?? '—'}</dd>

        <dt>Data/hora do aceite</dt>
        <dd>{row.q_acceptance_at ? formatDateTime(row.q_acceptance_at) : '—'}</dd>
      </dl>
    </Modal>
  );
}
