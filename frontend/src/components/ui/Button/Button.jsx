import { cn } from '../../../utils/cn.js';
import styles from './Button.module.css';

const VARIANTS = ['primary', 'secondary', 'ghost', 'danger'];

/**
 * Botao base do design system. `variant` cobre os 4 usos recorrentes nas
 * features (acao principal, secundaria, terciaria e destrutiva); `as="a"`
 * permite reuso como link estilizado sem duplicar CSS.
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  isLoading = false,
  fullWidth = false,
  as: Component = 'button',
  className,
  ...rest
}) {
  const resolvedVariant = VARIANTS.includes(variant) ? variant : 'primary';

  return (
    <Component
      className={cn(
        styles.button,
        styles[resolvedVariant],
        styles[size],
        fullWidth && styles.fullWidth,
        className,
      )}
      disabled={isLoading || rest.disabled}
      {...rest}
    >
      {isLoading && <span className={styles.spinner} aria-hidden="true" />}
      {!isLoading && Icon && iconPosition === 'left' && <Icon className={styles.icon} />}
      <span>{children}</span>
      {!isLoading && Icon && iconPosition === 'right' && <Icon className={styles.icon} />}
    </Component>
  );
}
