import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSupplierAuth } from '../../contexts/SupplierAuthContext.jsx';
import { ROUTES } from '../../constants/routes.js';
import RouteFallback from '../../app/RouteFallback.jsx';

// Contrato aberto pelo link do convite (/fase2/<token>): o token vai no login (?fase2) para o
// fornecedor sem conta conseguir se cadastrar e voltar para o contrato
const CONTRACT_LINK = /^\/fase2\/([^/]+)/;

function loginPathFor(pathname) {
  const match = CONTRACT_LINK.exec(pathname);
  return match ? `${ROUTES.suppliers.login}?fase2=${encodeURIComponent(match[1])}` : ROUTES.suppliers.login;
}

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
        to={loginPathFor(location.pathname)}
        replace
        state={{ returnTo: location.pathname }}
      />
    );
  }
  return <Outlet />;
}
