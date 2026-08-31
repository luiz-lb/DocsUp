import { cn } from '../../../utils/cn.js';
import { formatDateTime } from '../../../utils/formatters.js';
import styles from './Timeline.module.css';

/**
 * Linha do tempo vertical: aprovacoes de solicitacao, historico de auditoria,
 * status de validacao de documento. `items` = [{ title, description?, at?, tone? }]
 */
export default function Timeline({ items }) {
  return (
    <ol className={styles.timeline}>
      {items.map((item, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <li key={index} className={styles.item}>
          <span className={cn(styles.marker, styles[item.tone ?? 'neutral'])} />
          <div className={styles.content}>
            <div className={styles.row}>
              <p className={styles.title}>{item.title}</p>
              {item.at && <time className={styles.time}>{formatDateTime(item.at)}</time>}
            </div>
            {item.description && <p className={styles.description}>{item.description}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
