"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  API,
  type AuthUser,
  type OrganizationMembership,
} from "@/lib/advisor";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  organizations: OrganizationMembership[];
  acceptSession: (
    token: string,
    user: AuthUser,
    organizations: OrganizationMembership[],
  ) => void;
  switchOrganization: (organizationId: number) => Promise<void>;
  signOut: () => void;
};

type SessionResponse = {
  success: boolean;
  message?: string;
  token?: string;
  user?: AuthUser;
  organizations?: OrganizationMembership[];
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]);

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
        setOrganizations(
          Array.isArray(json.organizations)
            ? (json.organizations as OrganizationMembership[])
            : [],
        );
        setStatus("authenticated");
      })
      .catch(() => {
        setStatus("unauthenticated");
      });
  }, []);

  const acceptSession = useCallback(
    (
      token: string,
      nextUser: AuthUser,
      nextOrganizations: OrganizationMembership[],
    ) => {
      window.localStorage.setItem("advisora_token", token);
      setUser(nextUser);
      setOrganizations(nextOrganizations);
      setStatus("authenticated");
    },
    [],
  );

  const switchOrganization = useCallback(async (organizationId: number) => {
    const token = window.localStorage.getItem("advisora_token");
    if (!token) throw new Error("Sesi tidak ditemukan. Silakan masuk kembali.");

    const response = await fetch(`${API}/api/auth/organizations/select`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ organization_id: organizationId }),
    });

    let payload: SessionResponse;
    try {
      payload = (await response.json()) as SessionResponse;
    } catch {
      throw new Error(`Respons backend tidak valid (HTTP ${response.status}).`);
    }

    if (!response.ok || !payload.success || !payload.token || !payload.user) {
      throw new Error(payload.message || "Organisasi gagal diganti.");
    }

    window.localStorage.setItem("advisora_token", payload.token);
    setUser(payload.user);
    setOrganizations(payload.organizations ?? []);
  }, []);

  const signOut = useCallback(() => {
    window.localStorage.removeItem("advisora_token");
    setUser(null);
    setOrganizations([]);
    setStatus("unauthenticated");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        organizations,
        acceptSession,
        switchOrganization,
        signOut,
      }}
    >
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
