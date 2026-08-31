import { cn } from '../../../utils/cn.js';
import styles from './ScoreGauge.module.css';

const toneForScore = (score, thresholds) => {
  if (score >= thresholds.good) return 'success';
  if (score >= thresholds.warn) return 'warning';
  return 'danger';
};

/**
 * Gauge circular 0-100 via conic-gradient (sem lib de charts). Reusado para
 * o score de IA na validacao de documentos e para o overall_score do fornecedor.
 */
export default function ScoreGauge({ score, size = 96, label, thresholds = { good: 85, warn: 60 } }) {
  const clamped = Math.max(0, Math.min(100, score ?? 0));
  const tone = toneForScore(clamped, thresholds);

  return (
    <div className={styles.wrapper} style={{ width: size }}>
      <div
        className={cn(styles.ring, styles[tone])}
        style={{
          width: size,
          height: size,
          background: `conic-gradient(var(--gauge-color) ${clamped * 3.6}deg, #eef0f2 0deg)`,
        }}
      >
        <div className={styles.inner} style={{ width: size - 16, height: size - 16 }}>
          <span className={styles.value}>{Math.round(clamped)}</span>
        </div>
      </div>
      {label && <span className={styles.label}>{label}</span>}
    </div>
  );
}
