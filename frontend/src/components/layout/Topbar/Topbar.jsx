import { useState } from 'react';
import { MenuItem, Select } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { LuBell, LuMenu, LuLogOut } from 'react-icons/lu';
import { ErrorDialog } from '../../ui/index.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { DEPARTMENT } from '../../../constants/enums.js';
import { ROUTES } from '../../../constants/routes.js';
import styles from './Topbar.module.css';

/**
 * Barra superior: abre a Sidebar no mobile e traz um seletor de departamento
 * (troca o usuario demo) - permite pre-visualizar a navegacao/permissoes de
 * qualquer area sem precisar de um backend de auth ainda.
 */
export default function Topbar({ onOpenSidebar }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState(null);

  const handleLogout = async () => {
    const result = await logout();
    // Sem a resposta do backend o cookie continua valido: avisa em vez de fingir que saiu
    if (!result?.success) {
      setLogoutError(result?.body?.message ?? 'Não foi possível sair. Tente novamente.');
      return;
    }
    navigate(ROUTES.auth.login);
  };

  return (
    <header className={styles.topbar}>
      <button type="button" className={styles.menuButton} onClick={onOpenSidebar} aria-label="Abrir menu">
        <LuMenu />
      </button>

      <div className={styles.spacer} />

      <button type="button" className={styles.iconButton} aria-label="Notificações">
        <LuBell />
      </button>

      <Select
        size="small"
        value={user.id}
        onChange={(event) => switchDepartment(event.target.value)}
        className={styles.userSelect}
      >
          <MenuItem key={user.id} value={user.id}>
            {user.name} · {DEPARTMENT[user.department]?.label}
          </MenuItem>
      </Select>

      <button type="button" className={styles.iconButton} onClick={handleLogout} aria-label="Sair">
        <LuLogOut />
      </button>

      <ErrorDialog
        open={Boolean(logoutError)}
        onClose={() => setLogoutError(null)}
        title="Não foi possível sair"
        message={logoutError}
      />
    </header>
  );
}
