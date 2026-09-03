import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { meSupplier, loginSupplier, verifyMfaCode, logoutSupplier } from '../features/suppliers/api/suppliersApi.js';

const SupplierAuthContext = createContext(null);

/**
 * Contexto de autenticação exclusivo para fornecedores.
 * Separado do AuthContext dos colaboradores internos.
 *
 * Estado exposto:
 *  - supplier       : { id, cnpj, razaoSocial, nomeFantasia, registrationComplete }
 *  - isAuthenticated: boolean
 *  - isLoading      : boolean
 *  - loginPhase1    : (cnpj, password) => Promise<{ success, requiresMfa, devOtp? }>
 *  - loginPhase2    : (otp) => Promise<{ success, body }>
 *  - logout         : () => void
 */
export function SupplierAuthProvider({ children }) {
  const [supplier, setSupplier] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Tenta restaurar sessão a partir do cookie supplier_token
  useEffect(() => {
    meSupplier()
      .then((result) => {
        if (result.success) {
          setSupplier(result.body);
          setIsAuthenticated(true);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  /** Fase 1: CNPJ + senha. Retorna { success, requiresMfa, devOtp? } */
  const loginPhase1 = async (cnpj, password) => {
    return loginSupplier(cnpj, password);
  };

  /** Fase 2: OTP de 6 dígitos. Seta cookie e popula o contexto. */
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
    () => ({ supplier, isAuthenticated, isLoading, loginPhase1, loginPhase2, logout }),
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
