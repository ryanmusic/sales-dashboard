import { createContext, useContext, useState, type ReactNode } from 'react';

type Role = 'admin' | 'operator';

interface AuthContextType {
  token: string | null;
  role: Role;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

function parseRole(token: string | null): Role {
  if (!token) return 'operator';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role === 'admin' ? 'admin' : 'operator';
  } catch {
    return 'operator';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [role, setRole] = useState<Role>(() => parseRole(localStorage.getItem('token')));

  const login = async (username: string, password: string) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error('Invalid credentials');
    const data = await res.json();
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setRole(data.role || parseRole(data.token));
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setRole('operator');
  };

  return (
    <AuthContext.Provider value={{ token, role, isAdmin: role === 'admin', login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
