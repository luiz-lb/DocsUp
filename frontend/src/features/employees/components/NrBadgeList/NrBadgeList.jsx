import { NR_TYPES } from '../../../../mocks/catalog.js';
import styles from './NrBadgeList.module.css';

/** Lista compacta dos codigos de NR de um colaborador. */
export default function NrBadgeList({ nrIds }) {
  if (!nrIds.length) return <span className={styles.empty}>Nenhuma NR informada</span>;

  return (
    <div className={styles.row}>
      {nrIds.map((id) => (
        <span key={id} className={styles.badge}>
          {NR_TYPES.find((nr) => nr.id === id)?.code}
        </span>
      ))}
    </div>
  );
}
