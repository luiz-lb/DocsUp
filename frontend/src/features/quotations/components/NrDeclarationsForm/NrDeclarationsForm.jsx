import styles from './NrDeclarationsForm.module.css';

/**
 * "Quantos colaboradores tem NR X" — uma linha por NR exigida na solicitação.
 * As NRs vêm do backend (via prop `nrTypes`), não de um mock.
 *
 * @param {{ id, code, name }[]} nrTypes — NRs exigidas para a atividade
 * @param {{ [nrTypeId]: number }} values
 * @param {(next) => void} onChange
 */
export default function NrDeclarationsForm({ nrTypes = [], values, onChange }) {
  const update = (nrTypeId, count) => onChange({ ...values, [nrTypeId]: Math.max(0, Number(count) || 0) });

  if (nrTypes.length === 0) {
    return <p className={styles.empty}>Nenhuma NR exigida para esta contratação.</p>;
  }

  return (
    <div className={styles.grid}>
      {nrTypes.map((nr) => (
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
