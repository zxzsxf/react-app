import React, { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, Role, User } from './api';

const Context = createContext<{ user: User | null; loading: boolean; login: (username: string, password: string) => Promise<void>; logout: () => Promise<void> }>({ user: null, loading: true, login: async () => {}, logout: async () => {} });
export const useAuth = () => useContext(Context);
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false)); }, []);
  return <Context.Provider value={{ user, loading, login: async (username, password) => { setUser(await api.login(username, password)); }, logout: async () => { await api.logout(); setUser(null); } }}>{children}</Context.Provider>;
};
export const RequireAuth: React.FC<{ children: React.ReactNode; roles?: Role[] }> = ({ children, roles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div style={{ padding: 24 }}>验证登录中...</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.some(role => user.roles.includes(role))) return <div role="alert" style={{ padding: 24 }}>没有访问权限</div>;
  return <>{children}</>;
};
