import { cn } from '../../../utils/cn.js';
import styles from './Card.module.css';

/**
 * Compound component: <Card tone="light|dark"><Card.Header/><Card.Body/><Card.Footer/></Card>
 * `tone="dark"` reproduz o cartao teal/creme usado no hero das telas atuais.
 */
export default function Card({ tone = 'light', className, children, ...rest }) {
  return (
    <div className={cn(styles.card, styles[tone], className)} {...rest}>
      {children}
    </div>
  );
}

Card.Header = function CardHeader({ className, children, ...rest }) {
  return (
    <div className={cn(styles.header, className)} {...rest}>
      {children}
    </div>
  );
};

Card.Body = function CardBody({ className, children, ...rest }) {
  return (
    <div className={cn(styles.body, className)} {...rest}>
      {children}
    </div>
  );
};

Card.Footer = function CardFooter({ className, children, ...rest }) {
  return (
    <div className={cn(styles.footer, className)} {...rest}>
      {children}
    </div>
  );
};
