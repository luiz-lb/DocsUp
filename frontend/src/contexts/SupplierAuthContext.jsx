import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { meSupplier, loginSupplier, verifyMfaCode, logoutSupplier } from '../features/suppliers/api/suppliersApi.js';

const SupplierAuthContext = createContext(null);

/**
 * Contexto de autenticação exclusivo para fornecedores.
 * Separado do AuthContext dos colaboradores internos.
 *
 * Estado exposto:
 *  - supplier       : { supplierId, cnpj, razaoSocial, nomeFantasia, user: { id, role, name, email } }
 *  - isAuthenticated: boolean
 *  - isLoading      : boolean
 *  - loginPhase1    : (email, password) => Promise<{ success, body: { requiresMfa, devOtp? } }>
 *  - loginPhase2    : (otp) => Promise<{ success, body }>
 *  - refresh        : () => Promise — relê a sessão (ex.: depois de editar o perfil)
 *  - logout         : () => void
 */
export function SupplierAuthProvider({ children }) {
  const [supplier, setSupplier] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    const result = await meSupplier();
    if (result.success) {
      setSupplier(result.body);
      setIsAuthenticated(true);
    } else {
      setSupplier(null);
      setIsAuthenticated(false);
    }
    return result;
  };

  // Só restaura a sessão de fornecedor quando estamos na área do fornecedor
  // (portal, login/cadastro/código de acesso ou envio de documentos). Evita chamar o
  // /supplier/auth/me nas telas internas de colaborador.
  useEffect(() => {
    const path = window.location.pathname;
    const isSupplierArea = path.startsWith('/fornecedor') || path.startsWith('/fase2');

    if (!isSupplierArea) {
      setIsLoading(false);
      return;
    }

    refresh().finally(() => setIsLoading(false));
  }, []);

  /** Fase 1: e-mail do usuário + senha. Retorna { success, body: { requiresMfa, devOtp? } } */
  const loginPhase1 = async (email, password) => loginSupplier(email, password);

  /** Fase 2: código de 6 dígitos. Seta o cookie e popula o contexto. */
  const loginPhase2 = async (otp) => {
    const result = await verifyMfaCode(otp);
    if (result.success) {
      setSupplier(result.body.supplier);
      setIsAuthenticated(true);
    }
    return result;
  };

  const logout = async () => {
    await logoutSupplier();
    setSupplier(null);
    setIsAuthenticated(false);
  };

  const value = useMemo(
    () => ({ supplier, isAuthenticated, isLoading, loginPhase1, loginPhase2, refresh, logout }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supplier, isAuthenticated, isLoading],
  );

  return (
    <SupplierAuthContext.Provider value={value}>
      {children}
    </SupplierAuthContext.Provider>
  );
}

export function useSupplierAuth() {
  const context = useContext(SupplierAuthContext);
  if (!context) throw new Error('useSupplierAuth deve ser usado dentro de <SupplierAuthProvider>');
  return context;
}
