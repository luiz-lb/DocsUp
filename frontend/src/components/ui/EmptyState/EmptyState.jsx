import styles from './EmptyState.module.css';

/** Estado vazio generico para listas/tabelas sem dados ainda. */
export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className={styles.wrapper}>
      {Icon && <Icon className={styles.icon} />}
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action}
    </div>
  );
}
