import { useState } from 'react';
import { LuChevronDown, LuChevronRight, LuDownload, LuRefreshCw } from 'react-icons/lu';
import { Button, StatusBadge } from '../../../../components/ui/index.js';
import { DOCUMENT_STATUS } from '../../../../constants/enums.js';
import { cn } from '../../../../utils/cn.js';
import { formatDateOnly } from '../../../../utils/formatters.js';
import DeliveryHistoryTable from '../../../documents/components/DeliveryHistoryTable/index.js';
import styles from './SupplierDocumentItem.module.css';

// Status em que o RH devolveu o documento: a observação é o motivo
const RETURNED_STATUSES = [3, 4];

/**
 * Um documento enviado pelo fornecedor (visão do fornecedor, tela da Fase 2): status da
 * entrega atual, observação do RH, baixar, reenviar e o histórico de entregas (abre no "+").
 *
 * Props:
 *  - document      : { id, document_type_name, file_name, expires_at, status, observation, history }
 *  - canResend     : mostra o botão Reenviar
 *  - onResend      : () => void
 *  - onDownload    : (delivery) => void
 *  - downloadingId : id da entrega sendo baixada
 */
export default function SupplierDocumentItem({ document, canResend, onResend, onDownload, downloadingId }) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const history = document.history ?? [];
  const isReturned = RETURNED_STATUSES.includes(document.status);

  return (
    <div className={cn(styles.item, isReturned && styles.itemReturned)}>
      <div className={styles.header}>
        <div className={styles.info}>
          <strong className={styles.name}>{document.document_type_name}</strong>
          <span className={styles.meta}>
            {document.file_name}
            {document.expires_at && ` · válido até ${formatDateOnly(document.expires_at)}`}
          </span>
        </div>
        <StatusBadge enumMap={DOCUMENT_STATUS} value={document.status} />
      </div>

      {document.observation && (
        <p className={cn(styles.observation, isReturned && styles.observationReturned)}>
          <strong>{isReturned ? 'Motivo: ' : 'Observação: '}</strong>
          {document.observation}
        </p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.historyToggle}
          onClick={() => setIsHistoryOpen((open) => !open)}
          aria-expanded={isHistoryOpen}
        >
          {isHistoryOpen ? <LuChevronDown aria-hidden="true" /> : <LuChevronRight aria-hidden="true" />}
          Histórico de entregas ({history.length})
        </button>
        <div className={styles.buttons}>
          <Button
            size="sm"
            variant="ghost"
            className={styles.lightGhost}
            icon={LuDownload}
            isLoading={downloadingId === document.id}
            disabled={downloadingId !== null && downloadingId !== document.id}
            onClick={() => onDownload(document)}
          >
            Baixar
          </Button>
          {canResend && (
            <Button size="sm" variant="secondary" icon={LuRefreshCw} onClick={onResend}>
              Reenviar
            </Button>
          )}
        </div>
      </div>

      {isHistoryOpen && (
        <div className={styles.history}>
          <DeliveryHistoryTable deliveries={history} onDownload={onDownload} downloadingId={downloadingId} />
        </div>
      )}
    </div>
  );
}
