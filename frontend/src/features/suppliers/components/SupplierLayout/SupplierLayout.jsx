import { Drawer } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { LuMenu, LuLogOut } from 'react-icons/lu';
import { useDisclosure } from '../../../../hooks/useDisclosure.js';
import { useSupplierAuth } from '../../../../contexts/SupplierAuthContext.jsx';
import { ROUTES } from '../../../../constants/routes.js';
import Button from '../../../../components/ui/Button/index.js';
import SupplierSidebar from '../SupplierSidebar/index.js';
import styles from './SupplierLayout.module.css';

/**
 * Shell do portal do fornecedor: sidebar fixa no desktop, Drawer no mobile,
 * barra superior com logout e área de conteúdo. Espelha o DashboardLayout
 * dos colaboradores (Everest).
 */
export default function SupplierLayout({ children }) {
  const mobileSidebar = useDisclosure(false);
  const navigate = useNavigate();
  const { supplier, logout } = useSupplierAuth();

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.suppliers.login);
  };

  return (
    <div className={styles.shell}>
      <aside className={styles.desktopSidebar}>
        <SupplierSidebar supplier={supplier} />
      </aside>

      <Drawer anchor="left" open={mobileSidebar.isOpen} onClose={mobileSidebar.close}>
        <SupplierSidebar supplier={supplier} onNavigate={mobileSidebar.close} />
      </Drawer>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.menuButton}
            onClick={mobileSidebar.open}
            aria-label="Abrir menu"
          >
            <LuMenu />
          </button>
          <div className={styles.spacer} />
          <Button variant="ghost" className={styles.logoutBtn} icon={LuLogOut} size="sm" onClick={handleLogout}>
            Sair
          </Button>
        </header>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
