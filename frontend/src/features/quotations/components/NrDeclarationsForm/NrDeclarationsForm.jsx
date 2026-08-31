import { NR_TYPES } from '../../../../mocks/catalog.js';
import styles from './NrDeclarationsForm.module.css';

/**
 * "Quantos colaboradores tem NR X" - uma linha por NR do catalogo.
 * `values` = { [nrTypeId]: count }
 */
export default function NrDeclarationsForm({ values, onChange }) {
  const update = (nrTypeId, count) => onChange({ ...values, [nrTypeId]: Math.max(0, Number(count) || 0) });

  return (
    <div className={styles.grid}>
      {NR_TYPES.map((nr) => (
        <label key={nr.id} className={styles.row}>
          <span>
            <strong>{nr.code}</strong> — {nr.name}
          </span>
          <input
            type="number"
            min="0"
            value={values[nr.id] ?? 0}
            onChange={(event) => update(nr.id, event.target.value)}
          />
        </label>
      ))}
    </div>
  );
}
