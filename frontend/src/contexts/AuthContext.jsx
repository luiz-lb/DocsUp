import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEPARTMENT } from '../constants/enums.js';
import { loginApi, logoutApi, me } from '../features/auth/collaborator/api/authApi.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [userName, setUserName] = useState(null);
  const [userDepartament, setUserDepartament] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const findCookie = async () =>{
    const result = await me();

    if (result.success){
      setUserId(result.body.id);
      setUserEmail(result.body.email);
      setUserName(result.body.name);
      setUserDepartament(result.body.department);
      setUserRole(result.body.role);
      setIsAuthenticated(true);
    }
    return result;
  }

  const user = {
    id: userId,
    name: userName,
    email: userEmail,
    department: userDepartament,
    role: userRole
  };

  useEffect(() => {
    // Só busca a sessão de colaborador quando NÃO estamos na área do fornecedor
    // (portal, login/cadastro/MFA de fornecedor ou Fase 2). Evita chamar o /me
    // interno em telas que são exclusivas do fornecedor.
    const path = window.location.pathname;
    const isSupplierArea = path.startsWith('/fornecedor') || path.startsWith('/fase2');

    if (isSupplierArea) {
      setIsLoading(false);
      return;
    }

    findCookie().finally(() => setIsLoading(false));
  }, []);


  const login = async (email, password) => {
    const result = await loginApi(email, password);

    if (result.success){
      setUserId(result.body.id);
      setUserEmail(result.body.email);
      setUserName(result.body.name);
      setUserDepartament(result.body.department);
      setUserRole(result.body.role);
      setIsAuthenticated(true);
    }
    return result;
  };

  const clearUser = () => {
    setIsAuthenticated(false);
    setUserId(null);
    setUserEmail(null);
    setUserName(null);
    setUserDepartament(null);
    setUserRole(null);
  };

  const logout = async () => {
    // O cookie é httpOnly: só o backend consegue apagá-lo. Se a chamada falhar, a sessão
    // continua válida, então o estado também continua e o resultado volta para a tela avisar.
    const result = await logoutApi();
    if (!result?.success) return result;

    clearUser();
    return result;
  };

  // Relê o usuário logado no backend (ex.: depois de o Admin editar o próprio cadastro).
  // Se a sessão não vale mais (usuário inativado), limpa o estado e o RequireAuth leva ao login.
  const refreshUser = async () => {
    const result = await findCookie();
    if (!result.success) clearUser();
    return result;
  };

  const value = useMemo(() => {
    return {
      user,
      departmentLabel: DEPARTMENT[user.department]?.label,
      isAuthenticated,
      isLoading,
      login,
      logout,
      refreshUser,
    };
  }, [userId, userName, userEmail, userDepartament, userRole, isAuthenticated, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return context;
}
