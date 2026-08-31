import ScoreGauge from '../../../../components/ui/ScoreGauge/index.js';
import styles from './ScoreBreakdownCard.module.css';

const ROWS = [
  { key: 'quotationDeliveryScore', label: 'Prazo de entrega da cotacao', weightKey: 'quotation' },
  { key: 'documentationScore', label: 'Documentacao e retrabalho', weightKey: 'documentation' },
  { key: 'evaluationScore', label: 'Avaliacao (RH, Suprimentos, Obra)', weightKey: 'evaluation' },
];

/** Media ponderada de qualificacao do fornecedor: peso 1/3/5 conforme o criterio. */
export default function ScoreBreakdownCard({ score }) {
  return (
    <div className={styles.wrapper}>
      <ScoreGauge score={score.finalScore * 10} size={110} label="Score final" thresholds={{ good: 80, warn: 60 }} />

      <div className={styles.rows}>
        {ROWS.map((row) => (
          <div key={row.key} className={styles.row}>
            <span>{row.label}</span>
            <span className={styles.value}>
              {score[row.key].toFixed(1)} <small>(peso {score.weights[row.weightKey]})</small>
            </span>
          </div>
        ))}
        {score.reworkCount > 0 && (
          <p className={styles.reworkNote}>{score.reworkCount} retrabalho(s) de documentacao registrados.</p>
        )}
      </div>
    </div>
  );
}
