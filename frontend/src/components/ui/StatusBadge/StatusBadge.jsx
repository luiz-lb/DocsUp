import { cn } from '../../../utils/cn.js';
import { resolveEnum } from '../../../constants/enums.js';
import styles from './StatusBadge.module.css';

/**
 * Pill de status. Uso tipico: <StatusBadge enumMap={LABOR_REQUEST_STATUS} value={request.status} />
 * Tambem aceita `label`/`tone` diretos para casos que nao vem de um enum do banco.
 */
export default function StatusBadge({ enumMap, value, label, tone, className }) {
  const resolved = enumMap ? resolveEnum(enumMap, value) : { label, tone: tone ?? 'neutral' };

  return (
    <span className={cn(styles.badge, styles[resolved.tone] ?? styles.neutral, className)}>
      <span className={styles.dot} />
      {resolved.label}
    </span>
  );
}
