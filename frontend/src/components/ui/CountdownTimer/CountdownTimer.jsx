import { LuTimer } from 'react-icons/lu';
import { useCountdown } from '../../../hooks/useCountdown.js';
import { formatDuration } from '../../../utils/formatters.js';
import { cn } from '../../../utils/cn.js';
import styles from './CountdownTimer.module.css';

/**
 * Contagem regressiva visual usada no SLA de resposta de cotacao e no prazo
 * da Fase 2 (upload de colaboradores). Fica critico (vermelho piscando) nos
 * ultimos 10% do tempo.
 */
export default function CountdownTimer({ deadline, startedAt, expiredLabel = 'Prazo expirado' }) {
  const { remainingMs, isExpired } = useCountdown(deadline);

  const totalMs = startedAt ? new Date(deadline).getTime() - new Date(startedAt).getTime() : null;
  const isCritical = totalMs ? remainingMs / totalMs < 0.1 && !isExpired : false;

  return (
    <div className={cn(styles.wrapper, isExpired && styles.expired, isCritical && styles.critical)}>
      <LuTimer className={styles.icon} />
      <span>{isExpired ? expiredLabel : formatDuration(remainingMs)}</span>
    </div>
  );
}
