import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSupplierAuth } from '../../contexts/SupplierAuthContext.jsx';
import { ROUTES } from '../../constants/routes.js';
import RouteFallback from '../../app/RouteFallback.jsx';

// Telas abertas por link de e-mail: o token vai no login (?tokenProposta / ?fase2) para o
// fornecedor sem conta conseguir se cadastrar e voltar para a cotação ou para a Fase 2
const LINK_ROUTES = [
  { pattern: /^\/cotacoes\/responder\/([^/]+)/, param: 'tokenProposta' },
  { pattern: /^\/fase2\/([^/]+)/, param: 'fase2' },
];

function loginPathFor(pathname) {
  for (const { pattern, param } of LINK_ROUTES) {
    const match = pattern.exec(pathname);
    if (match) return `${ROUTES.suppliers.login}?${param}=${encodeURIComponent(match[1])}`;
  }
  return ROUTES.suppliers.login;
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
