import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEPARTMENT } from '../constants/enums.js';
import { loginApi, me } from '../features/auth/collaborator/api/authApi.js';

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

  const logout = () => {
    setIsAuthenticated(false);
    setUserId(null);
    setUserEmail(null);
    setUserName(null);
    setUserDepartament(null);
    setUserRole(null);
  };

  const value = useMemo(() => {
    return {
      user,
      departmentLabel: DEPARTMENT[user.department]?.label,
      isAuthenticated,
      isLoading,
      login,
      logout,
    };
  }, [userId, userName, userEmail, userDepartament, userRole, isAuthenticated, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return context;
}
