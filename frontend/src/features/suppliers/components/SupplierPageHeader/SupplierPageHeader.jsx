import { Link } from 'react-router-dom';
import { LuArrowLeft } from 'react-icons/lu';
import styles from './SupplierPageHeader.module.css';

/**
 * Cabeçalho das páginas do portal do fornecedor: "PORTAL DO FORNECEDOR", título, um texto de
 * apoio (ex.: a solicitação) e, opcionalmente, o link de volta e ações à direita.
 *
 * Props:
 *  - title       : string
 *  - subtitle    : string | node
 *  - backTo      : rota do link de volta (opcional)
 *  - backLabel   : texto do link de volta
 *  - actions     : node à direita (opcional)
 */
export default function SupplierPageHeader({ title, subtitle, backTo, backLabel, actions }) {
  return (
    <div className={styles.header}>
      {backTo && (
        <Link to={backTo} className={styles.back}>
          <LuArrowLeft aria-hidden="true" /> {backLabel}
        </Link>
      )}
      <div className={styles.row}>
        <div className={styles.text}>
          <p className={styles.eyebrow}>Portal do Fornecedor</p>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>
  );
}
