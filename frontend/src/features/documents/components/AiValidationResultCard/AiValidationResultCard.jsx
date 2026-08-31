import ScoreGauge from '../../../../components/ui/ScoreGauge/index.js';
import styles from './AiValidationResultCard.module.css';

/**
 * Resultado da validacao por IA: score 0-100 + pontos verificados em JSON.
 * Score abaixo de 85 fica destacado - e' o gatilho que manda o doc para
 * revisao manual de RH/Seguranca.
 */
export default function AiValidationResultCard({ score, checklist }) {
  return (
    <div className={styles.wrapper}>
      <ScoreGauge score={score} size={88} label="Score IA" thresholds={{ good: 85, warn: 60 }} />
      <ul className={styles.checklist}>
        {checklist.map((item) => (
          <li key={item.point} className={styles.item}>
            <span>{item.point}</span>
            <strong className={item.score < 85 ? styles.low : styles.high}>{item.score}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
