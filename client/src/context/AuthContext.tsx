import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const TOKEN_KEY = 'teamflow_token';
const USER_KEY = 'teamflow_user';
const PASSWORD_CHANGE_KEY = 'teamflow_requires_password_change';
const LAST_ACTIVITY_KEY = 'teamflow_last_activity';
const IDLE_TIMEOUT_MS = 4 * 60 * 60 * 1000;

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
  requiresPasswordChange: boolean;
  setSession: (token: string, user: SessionUser, requiresPasswordChange?: boolean) => void;
  completePasswordChange: () => void;
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
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    window.localStorage.removeItem(PASSWORD_CHANGE_KEY);
    window.localStorage.removeItem(LAST_ACTIVITY_KEY);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let storedToken = window.localStorage.getItem(TOKEN_KEY);
    const storedUser = readStoredUser();
    const storedPasswordChange = window.localStorage.getItem(PASSWORD_CHANGE_KEY) === 'true';
    const storedLastActivity = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY));
    const isSessionExpired =
      Boolean(storedToken) &&
      storedLastActivity > 0 &&
      Date.now() - storedLastActivity >= IDLE_TIMEOUT_MS;

    if (isSessionExpired) {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
      window.localStorage.removeItem(PASSWORD_CHANGE_KEY);
      window.localStorage.removeItem(LAST_ACTIVITY_KEY);
      storedToken = null;
    } else if (storedToken && storedLastActivity <= 0) {
      window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    } else if (!storedToken) {
      window.localStorage.removeItem(LAST_ACTIVITY_KEY);
    }

    setToken(storedToken);
    setUser(
      !isSessionExpired && storedUser && storedToken && !storedUser.role
        ? { ...storedUser, role: decodeRoleFromToken(storedToken) ?? 'MEMBER' }
        : isSessionExpired ? null : storedUser
    );
    setRequiresPasswordChange(!isSessionExpired && storedPasswordChange);
    setIsAuthReady(true);
  }, []);

  useEffect(() => {
    if (!isAuthReady || !token) {
      return;
    }

    let lastActivityAt = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY)) || Date.now();
    let lastPersistedAt = lastActivityAt;
    let timeoutId: number | undefined;

    function isSessionExpired() {
      const sharedActivityAt = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY));
      if (sharedActivityAt > lastActivityAt) {
        lastActivityAt = sharedActivityAt;
      }
      return Date.now() - lastActivityAt >= IDLE_TIMEOUT_MS;
    }

    function scheduleExpiration() {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }

      const remaining = IDLE_TIMEOUT_MS - (Date.now() - lastActivityAt);
      if (remaining <= 0) {
        logout();
        return;
      }

      timeoutId = window.setTimeout(() => {
        if (isSessionExpired()) {
          logout();
        } else {
          scheduleExpiration();
        }
      }, remaining);
    }

    function recordActivity() {
      if (isSessionExpired()) {
        logout();
        return;
      }

      lastActivityAt = Date.now();
      // Limit storage writes for high-frequency events such as pointer movement.
      if (lastActivityAt - lastPersistedAt >= 1000) {
        window.localStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivityAt));
        lastPersistedAt = lastActivityAt;
        scheduleExpiration();
      }
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === TOKEN_KEY && !event.newValue) {
        logout();
        return;
      }

      if (event.key === LAST_ACTIVITY_KEY && event.newValue) {
        const sharedActivityAt = Number(event.newValue);
        if (sharedActivityAt > lastActivityAt) {
          lastActivityAt = sharedActivityAt;
          lastPersistedAt = sharedActivityAt;
          scheduleExpiration();
        }
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        recordActivity();
      }
    }

    scheduleExpiration();
    window.addEventListener('pointerdown', recordActivity);
    window.addEventListener('pointermove', recordActivity);
    window.addEventListener('keydown', recordActivity);
    window.addEventListener('scroll', recordActivity, { passive: true });
    window.addEventListener('touchstart', recordActivity, { passive: true });
    window.addEventListener('wheel', recordActivity, { passive: true });
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener('pointerdown', recordActivity);
      window.removeEventListener('pointermove', recordActivity);
      window.removeEventListener('keydown', recordActivity);
      window.removeEventListener('scroll', recordActivity);
      window.removeEventListener('touchstart', recordActivity);
      window.removeEventListener('wheel', recordActivity);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthReady, logout, token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      isAuthReady,
      requiresPasswordChange,
      setSession: (nextToken: string, nextUser: SessionUser, nextRequiresPasswordChange = false) => {
        const nextRole = nextUser.role ?? decodeRoleFromToken(nextToken) ?? 'MEMBER';
        const sessionUser = { ...nextUser, role: nextRole };
        window.localStorage.setItem(TOKEN_KEY, nextToken);
        window.localStorage.setItem(USER_KEY, JSON.stringify(sessionUser));
        window.localStorage.setItem(PASSWORD_CHANGE_KEY, String(nextRequiresPasswordChange));
        window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
        setToken(nextToken);
        setUser(sessionUser);
        setRequiresPasswordChange(nextRequiresPasswordChange);
      },
      completePasswordChange: () => {
        window.localStorage.removeItem(PASSWORD_CHANGE_KEY);
        setRequiresPasswordChange(false);
      },
      logout,
    }),
    [isAuthReady, logout, requiresPasswordChange, token, user]
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
