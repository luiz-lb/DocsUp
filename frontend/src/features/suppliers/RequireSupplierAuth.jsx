import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSupplierAuth } from '../../contexts/SupplierAuthContext.jsx';
import { ROUTES } from '../../constants/routes.js';
import RouteFallback from '../../app/RouteFallback.jsx';

/**
 * Guarda de rota do portal do fornecedor: sem sessão de fornecedor válida
 * (cookie supplier_token), redireciona para o login do fornecedor — mesma
 * regra aplicada às telas internas de colaborador.
 *
 * Preserva a rota de origem em `state.returnTo` para retornar após o login.
 */
export default function RequireSupplierAuth() {
  const { isAuthenticated, isLoading } = useSupplierAuth();
  const location = useLocation();

  if (isLoading) return <RouteFallback />;
  if (!isAuthenticated) {
    return (
      <Navigate
        to={ROUTES.suppliers.login}
        replace
        state={{ returnTo: location.pathname }}
      />
    );
  }
  return <Outlet />;
}
