import { LuDownload } from 'react-icons/lu';
import { Button, StatusBadge } from '../../../../components/ui/index.js';
import { DOCUMENT_STATUS } from '../../../../constants/enums.js';
import { formatDateOnly, formatDateTime } from '../../../../utils/formatters.js';
import styles from './DeliveryHistoryTable.module.css';

/**
 * Histórico de entregas de um documento, mais nova primeiro: data de entrega, validade,
 * arquivo, análise (status daquela entrega) e observação do RH.
 * Usado pelo RH (modal em Docs de Fornecedores) e pelo fornecedor (tela da Fase 2).
 *
 * Props:
 *  - deliveries   : [{ id, version, is_current, status, file_name, expires_at, uploaded_at,
 *                      observation, reviewer_name?, reviewed_at? }]
 *  - onDownload   : (delivery) => void — sem ele, o arquivo não tem botão de baixar
 *  - downloadingId: id da entrega sendo baixada (mostra o carregando)
 *  - showReviewer : mostra quem analisou e quando (visão do RH)
 */
export default function DeliveryHistoryTable({ deliveries = [], onDownload, downloadingId = null, showReviewer = false }) {
  if (deliveries.length === 0) {
    return <p className={styles.empty}>Nenhuma entrega registrada.</p>;
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Data de entrega</th>
            <th>Validade</th>
            <th>Arquivo</th>
            <th>Análise</th>
            <th>Observação</th>
          </tr>
        </thead>
        <tbody>
          {deliveries.map((delivery) => (
            <tr key={delivery.id} className={delivery.is_current ? styles.current : undefined}>
              <td data-label="Data de entrega">
                {formatDateTime(delivery.uploaded_at)}
                {delivery.is_current && <span className={styles.currentTag}>atual</span>}
              </td>
              <td data-label="Validade">{delivery.expires_at ? formatDateOnly(delivery.expires_at) : '—'}</td>
              <td data-label="Arquivo">
                <div className={styles.fileCell}>
                  <span className={styles.fileName} title={delivery.file_name}>{delivery.file_name}</span>
                  {onDownload && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={LuDownload}
                      isLoading={downloadingId === delivery.id}
                      disabled={downloadingId !== null && downloadingId !== delivery.id}
                      onClick={() => onDownload(delivery)}
                      title="Baixar este arquivo"
                      aria-label={`Baixar ${delivery.file_name}`}
                    />
                  )}
                </div>
              </td>
              <td data-label="Análise">
                <StatusBadge enumMap={DOCUMENT_STATUS} value={delivery.status} />
              </td>
              <td data-label="Observação">
                {delivery.observation ? (
                  <span className={styles.observation}>{delivery.observation}</span>
                ) : (
                  <span className={styles.muted}>—</span>
                )}
                {showReviewer && delivery.reviewer_name && (
                  <span className={styles.reviewer}>
                    {delivery.reviewer_name} · {formatDateTime(delivery.reviewed_at)}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
