import { Drawer } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { useDisclosure } from '../../../hooks/useDisclosure.js';
import Sidebar from '../Sidebar/index.js';
import Topbar from '../Topbar/index.js';
import styles from './DashboardLayout.module.css';

/**
 * Shell principal do app autenticado: sidebar fixa no desktop, Drawer no
 * mobile, Topbar + area de conteudo com <Outlet/> das rotas aninhadas.
 */
export default function DashboardLayout() {
  const mobileSidebar = useDisclosure(false);

  return (
    <div className={styles.shell}>
      <aside className={styles.desktopSidebar}>
        <Sidebar />
      </aside>

      <Drawer anchor="left" open={mobileSidebar.isOpen} onClose={mobileSidebar.close}>
        <Sidebar onNavigate={mobileSidebar.close} />
      </Drawer>

      <div className={styles.main}>
        <Topbar onOpenSidebar={mobileSidebar.open} />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
