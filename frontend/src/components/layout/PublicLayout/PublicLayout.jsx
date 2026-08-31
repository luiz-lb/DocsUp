import { Outlet } from 'react-router-dom';
import styles from './PublicLayout.module.css';

/**
 * Shell para paginas sem sessao interna: login/MFA/cadastro de fornecedor
 * e a submissao de cotacao via link por token. Sem sidebar - o fornecedor
 * so ve o que aquele link permite.
 */
export default function PublicLayout() {
  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <img src="/imgs/logoDocs.png" alt="DocsUp" className={styles.logo} />
      </div>
      <div className={styles.content}>
        <Outlet />
      </div>
    </div>
  );
}
