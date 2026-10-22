import { NavLink, useLocation } from 'react-router-dom';
import { LuLayoutDashboard, LuUser, LuBuilding2, LuFolderUp } from 'react-icons/lu';
import { cn } from '../../../../utils/cn.js';
import { ROUTES } from '../../../../constants/routes.js';
import styles from './SupplierSidebar.module.css';

// `section`: telas abertas a partir do item que também o deixam marcado (ex.: a cotação
// é aberta em "Minhas cotações"; a Fase 2, em "Documentos (Fase 2)")
const NAV_ITEMS = [
  { label: 'Minhas cotações', to: ROUTES.suppliers.portal, icon: LuLayoutDashboard, end: true, section: /^\/cotacoes\/responder\// },
  { label: 'Documentos (Fase 2)', to: ROUTES.suppliers.documents, icon: LuFolderUp, section: /^\/fase2\// },
  { label: 'Perfil da empresa', to: ROUTES.suppliers.myProfile, icon: LuBuilding2 },
];

/**
 * Navegação lateral do portal do fornecedor — espelha o visual da sidebar
 * interna (colaboradores da Everest), com a identidade DocsUp.
 */
export default function SupplierSidebar({ onNavigate, supplier }) {
  const { pathname } = useLocation();

  return (
    <div className={styles.sidebar}>
      <img src="/imgs/logoDocs.png" alt="DocsUp" className={styles.logo} />

      <div className={styles.supplierBox}>
        <span className={styles.supplierLabel}>Fornecedor</span>
        <span className={styles.supplierName}>{supplier?.razaoSocial ?? '—'}</span>
        {supplier?.cnpj && <span className={styles.supplierCnpj}>CNPJ: {supplier.cnpj}</span>}
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map(({ label, to, icon: Icon, end, section }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) => cn(styles.link, (isActive || section?.test(pathname)) && styles.active)}
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
