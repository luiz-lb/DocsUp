import { NavLink } from 'react-router-dom';
import { LuLayoutDashboard, LuUser } from 'react-icons/lu';
import { cn } from '../../../../utils/cn.js';
import { ROUTES } from '../../../../constants/routes.js';
import styles from './SupplierSidebar.module.css';

const NAV_ITEMS = [
  { label: 'Minhas cotações', to: ROUTES.suppliers.portal, icon: LuLayoutDashboard, end: true },
];

/**
 * Navegação lateral do portal do fornecedor — espelha o visual da sidebar
 * interna (colaboradores da Everest), com a identidade DocsUp.
 */
export default function SupplierSidebar({ onNavigate, supplier }) {
  return (
    <div className={styles.sidebar}>
      <img src="/imgs/logoDocs.png" alt="DocsUp" className={styles.logo} />

      <div className={styles.supplierBox}>
        <span className={styles.supplierLabel}>Fornecedor</span>
        <span className={styles.supplierName}>{supplier?.razaoSocial ?? '—'}</span>
        {supplier?.cnpj && <span className={styles.supplierCnpj}>CNPJ: {supplier.cnpj}</span>}
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) => cn(styles.link, isActive && styles.active)}
          >
            <Icon className={styles.icon} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className={styles.footer}>
        <LuUser className={styles.footerIcon} />
        <span>Portal do Fornecedor</span>
      </div>
    </div>
  );
}
