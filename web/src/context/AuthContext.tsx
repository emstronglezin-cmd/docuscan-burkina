import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setTokens, clearTokens } from '../lib/api';

export interface Me {
  id: string;
  email: string;
  fullName?: string;
  role: string;
  creditBalance: number;
  isActive: boolean;
}

interface AuthContextValue {
  user: Me | null;
  loading: boolean;
  refreshMe: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshMe() {
    try {
      const me = await api.get<Me>('/users/me');
      setUser(me);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('docuscan_access_token');
    if (token) {
      refreshMe().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<{ user: Me; tokens: { accessToken: string; refreshToken: string } }>(
      '/auth/login',
      { email, password },
    );
    setTokens(res.tokens.accessToken, res.tokens.refreshToken);
    setUser(res.user);
  }

  async function register(email: string, password: string, fullName?: string) {
    const res = await api.post<{ user: Me; tokens: { accessToken: string; refreshToken: string } }>(
      '/auth/register',
      { email, password, fullName },
    );
    setTokens(res.tokens.accessToken, res.tokens.refreshToken);
    setUser(res.user);
  }

  function logout() {
    clearTokens();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, refreshMe, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}
