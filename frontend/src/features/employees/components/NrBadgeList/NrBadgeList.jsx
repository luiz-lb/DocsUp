import styles from './NrBadgeList.module.css';

/**
 * Lista compacta dos codigos de NR de um colaborador.
 *
 * Aceita `nrs` (array vindo do backend: { nr_type_id, nr_code, nr_name }).
 * Mantem compatibilidade com a prop antiga `nrIds` (apenas ids) quando os
 * codigos ja vem resolvidos como labels.
 */
export default function NrBadgeList({ nrs, nrIds }) {
  const items = Array.isArray(nrs) && nrs.length > 0
    ? nrs.map((nr) => ({ key: nr.nr_type_id, code: nr.nr_code }))
    : (nrIds ?? []).map((id) => ({ key: id, code: id }));

  if (items.length === 0) {
    return <span className={styles.empty}>Nenhuma NR informada</span>;
  }

  return (
    <div className={styles.row}>
      {items.map((item) => (
        <span key={item.key} className={styles.badge}>
          {item.code}
        </span>
      ))}
    </div>
  );
}
