import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { ROUTES } from '../../../constants/routes.js';
import RouteFallback from '../../../app/RouteFallback.jsx';

/**
 * Guarda de rota: envolve o DashboardLayout no router.jsx. Sem sessao,
 * redireciona para o login do colaborador em vez de renderizar o <Outlet/>
 * com as paginas internas.
 */
export default function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <RouteFallback />;
  if (!isAuthenticated) return <Navigate to={ROUTES.auth.login} replace />;
  return <Outlet />;
}
