import { Outlet } from 'react-router-dom';
import { LuShieldAlert } from 'react-icons/lu';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { DEPARTMENT_ID } from '../../../constants/enums.js';
import EmptyState from '../../../components/ui/EmptyState/index.js';

/**
 * Guarda de rota por perfil (users.department), usada dentro do RequireAuth.
 * O Admin passa sempre. Quem não tem o perfil vê o aviso, sem a página.
 * É só experiência de uso: a permissão de verdade é checada no backend (requireRole).
 */
export default function RequireDepartment({ allowed = [] }) {
  const { user } = useAuth();
  const canAccess = user.department === DEPARTMENT_ID.ADMIN || allowed.includes(user.department);

  if (!canAccess) {
    return (
      <EmptyState
        icon={LuShieldAlert}
        title="Acesso restrito"
        description="Seu perfil não tem permissão para acessar esta página."
      />
    );
  }

  return <Outlet />;
}
