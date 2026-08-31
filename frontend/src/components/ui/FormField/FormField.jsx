import { cn } from '../../../utils/cn.js';
import styles from './FormField.module.css';

/**
 * Envolve input/select/textarea com label + mensagem de erro consistentes.
 * `as` escolhe o elemento nativo; `children` sobrescreve para casos custom
 * (ex.: um DatePicker ou um componente de mascara proprio).
 */
export default function FormField({
  label,
  hint,
  error,
  required,
  as: Component = 'input',
  className,
  children,
  ...rest
}) {
  return (
    <label className={cn(styles.field, error && styles.hasError, className)}>
      {label && (
        <span className={styles.label}>
          {label}
          {required && <span className={styles.required}> *</span>}
        </span>
      )}
      {children ?? <Component {...rest} />}
      {error ? <span className={styles.error}>{error}</span> : hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}
