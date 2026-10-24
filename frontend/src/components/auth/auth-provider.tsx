"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { API, type AuthUser } from "@/lib/advisor";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  acceptSession: (token: string, user: AuthUser) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem("advisora_token");
    if (!token) {
      void Promise.resolve().then(() => setStatus("unauthenticated"));
      return;
    }

    void fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok || !json.success || !json.user) {
          window.localStorage.removeItem("advisora_token");
          setUser(null);
          setStatus("unauthenticated");
          return;
        }
        setUser(json.user as AuthUser);
        setStatus("authenticated");
      })
      .catch(() => {
        setStatus("unauthenticated");
      });
  }, []);

  const acceptSession = useCallback((token: string, nextUser: AuthUser) => {
    window.localStorage.setItem("advisora_token", token);
    setUser(nextUser);
    setStatus("authenticated");
  }, []);

  const signOut = useCallback(() => {
    window.localStorage.removeItem("advisora_token");
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, acceptSession, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth harus digunakan di dalam AuthProvider.");
  }
  return context;
}
