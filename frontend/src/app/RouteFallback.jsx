import styles from './RouteFallback.module.css';

/** Fallback do Suspense para paginas lazy - evita tela branca no code-split. */
export default function RouteFallback() {
  return (
    <div className={styles.wrapper}>
      <span className={styles.spinner} />
    </div>
  );
}
