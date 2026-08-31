import { MenuItem, Select } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { LuBell, LuMenu, LuLogOut } from 'react-icons/lu';
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

  const handleLogout = () => {
    logout();
    navigate(ROUTES.auth.login);
  };

  return (
    <header className={styles.topbar}>
      <button type="button" className={styles.menuButton} onClick={onOpenSidebar} aria-label="Abrir menu">
        <LuMenu />
      </button>

      <div className={styles.spacer} />

      <button type="button" className={styles.iconButton} aria-label="Notificacoes">
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
    </header>
  );
}
