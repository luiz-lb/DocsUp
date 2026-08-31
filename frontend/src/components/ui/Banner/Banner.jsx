import { LuInfo, LuTriangleAlert, LuCircleCheck, LuOctagonAlert } from 'react-icons/lu';
import { cn } from '../../../utils/cn.js';
import styles from './Banner.module.css';

const ICONS = {
  info: LuInfo,
  success: LuCircleCheck,
  warning: LuTriangleAlert,
  danger: LuOctagonAlert,
};

/**
 * Faixa de alerta contextual: bloqueio de pagamento, prazo estourado de Fase 2,
 * aviso de omissao de documentacao no fluxo de cotacao.
 */
export default function Banner({ tone = 'info', title, description, actions, center = false }) {
  const Icon = ICONS[tone] ?? ICONS.info;

  return (
    <div className={cn(styles.banner, styles[tone], center && styles.center)}>
      <Icon className={styles.icon} />
      <div className={styles.content}>
        {title && <p className={styles.title}>{title}</p>}
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
