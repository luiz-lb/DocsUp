import styles from './PageHeader.module.css';

/**
 * Cabecalho padrao de pagina interna: eyebrow + titulo + descricao + slot de acoes.
 * Reutilizado por praticamente toda pagina de lista/detalhe das features.
 */
export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className={styles.header}>
      <div>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
