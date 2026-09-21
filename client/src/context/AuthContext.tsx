import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const TOKEN_KEY = 'teamflow_token';
const USER_KEY = 'teamflow_user';

type SessionUser = {
  id: string;
  name: string;
  username?: string;
  email: string;
  role?: 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';
  title?: string;
};

type AuthContextValue = {
  token: string | null;
  user: SessionUser | null;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  setSession: (token: string, user: SessionUser) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): SessionUser | null {
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

function decodeRoleFromToken(token: string): SessionUser['role'] | null {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) {
      return null;
    }

    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const parsed = JSON.parse(window.atob(padded)) as { role?: unknown };

    if (parsed.role === 'ADMIN' || parsed.role === 'MANAGER' || parsed.role === 'MEMBER' || parsed.role === 'VIEWER') {
      return parsed.role;
    }

    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(TOKEN_KEY);
    const storedUser = readStoredUser();

    setToken(storedToken);
    setUser(
      storedUser && storedToken && !storedUser.role
        ? { ...storedUser, role: decodeRoleFromToken(storedToken) ?? 'MEMBER' }
        : storedUser
    );
    setIsAuthReady(true);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      isAuthReady,
      setSession: (nextToken: string, nextUser: SessionUser) => {
        const nextRole = nextUser.role ?? decodeRoleFromToken(nextToken) ?? 'MEMBER';
        const sessionUser = { ...nextUser, role: nextRole };
        window.localStorage.setItem(TOKEN_KEY, nextToken);
        window.localStorage.setItem(USER_KEY, JSON.stringify(sessionUser));
        setToken(nextToken);
        setUser(sessionUser);
      },
      logout: () => {
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
      },
    }),
    [isAuthReady, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
