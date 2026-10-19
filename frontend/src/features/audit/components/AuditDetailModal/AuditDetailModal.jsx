import { Modal, Button, StatusBadge } from '../../../../components/ui/index.js';
import { AUDIT_ACTION } from '../../../../constants/enums.js';
import { formatDateTime } from '../../../../utils/formatters.js';
import { buildChanges, describeActor, describeTarget } from '../../auditFormat.js';
import styles from './AuditDetailModal.module.css';

/**
 * Detalhe de um registro de auditoria: quem, quando, de onde e o antes/depois.
 *
 * Props:
 *  - entry   : linha da auditoria (null = fechado)
 *  - onClose : () => void
 */
export default function AuditDetailModal({ entry, onClose }) {
  if (!entry) return null;

  const actor = describeActor(entry);
  const target = describeTarget(entry);
  const changes = buildChanges(entry);

  return (
    <Modal
      open
      onClose={onClose}
      title="Detalhes da auditoria"
      maxWidth="md"
      actions={<Button variant="ghost" onClick={onClose}>Fechar</Button>}
    >
      <dl className={styles.info}>
        <dt>Quando</dt>
        <dd>{formatDateTime(entry.created_at)}</dd>

        <dt>Ação</dt>
        <dd><StatusBadge enumMap={AUDIT_ACTION} value={entry.action} /></dd>

        <dt>Quem fez</dt>
        <dd>
          {actor.title}
          {actor.subtitle && <span className={styles.muted}> · {actor.subtitle}</span>}
        </dd>

        <dt>Alvo</dt>
        <dd>
          {target.title}
          {target.subtitle && <span className={styles.muted}> · {target.subtitle}</span>}
        </dd>

        <dt>IP</dt>
        <dd>{entry.ip_address ?? '—'}</dd>

        <dt>Navegador</dt>
        <dd className={styles.userAgent}>{entry.user_agent ?? '—'}</dd>
      </dl>

      <h4 className={styles.changesTitle}>O que mudou</h4>
      {changes.length === 0 ? (
        <p className={styles.muted}>Sem detalhes registrados.</p>
      ) : (
        <table className={styles.changes}>
          <thead>
            <tr>
              <th>Campo</th>
              <th>Antes</th>
              <th>Depois</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((change) => (
              <tr key={change.field}>
                <td>{change.label}</td>
                <td>{change.before}</td>
                <td>{change.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
