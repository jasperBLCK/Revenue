import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiClient } from "../api/client";
import type { Manager } from "../api/types";

const TOKEN_KEY = "revenuepilot.token";
const MANAGER_KEY = "revenuepilot.manager";

interface AuthState {
  token: string | null;
  manager: Manager | null;
  client: ApiClient;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function readManager(): Manager | null {
  try {
    const raw = localStorage.getItem(MANAGER_KEY);
    return raw ? (JSON.parse(raw) as Manager) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );
  const [manager, setManager] = useState<Manager | null>(() => readManager());

  // A single client instance, kept in sync with the active token.
  const client = useMemo(() => new ApiClient(token), [token]);

  const login = useCallback(async (email: string, password: string) => {
    const auth = await new ApiClient().login(email, password);
    localStorage.setItem(TOKEN_KEY, auth.access_token);
    localStorage.setItem(MANAGER_KEY, JSON.stringify(auth.manager));
    setToken(auth.access_token);
    setManager(auth.manager);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(MANAGER_KEY);
    setToken(null);
    setManager(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ token, manager, client, login, logout }),
    [token, manager, client, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
