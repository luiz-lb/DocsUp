import { NavLink } from 'react-router-dom';
import { cn } from '../../../utils/cn.js';
import { visibleNavItems } from '../../../constants/navigation.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import styles from './Sidebar.module.css';

/** Navegacao lateral filtrada por departamento do usuario logado. */
export default function Sidebar({ onNavigate }) {
  const { user } = useAuth();
  const items = visibleNavItems(user.department);

  return (
    <div className={styles.sidebar}>
      <img src="/imgs/logoDocs.png" alt="DocsUp" className={styles.logo} />
      <nav className={styles.nav}>
        {items.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            className={({ isActive }) => cn(styles.link, isActive && styles.active)}
          >
            <Icon className={styles.icon} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
