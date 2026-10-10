import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const handle = useCallback(async (promise) => {
    const d = await promise;
    setToken(d.token);
    setUser(d.user);
    return d;
  }, []);

  const login = useCallback((email, password) => handle(api('/auth/login', { method: 'POST', body: { email, password } })), [handle]);
  const demoLogin = useCallback((role) => handle(api('/auth/demo', { method: 'POST', body: { role } })), [handle]);
  const register = useCallback((payload) => handle(api('/auth/register', { method: 'POST', body: payload })), [handle]);
  const logout = useCallback(() => { setToken(null); setUser(null); }, []);
  const refresh = useCallback(async () => {
    const d = await api('/auth/me');
    setUser(d.user);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, login, demoLogin, register, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
