import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type Role = "vendedor" | "supervisor" | "administrador" | "cliente";

export const ROLE_LABEL: Record<Role, string> = {
  vendedor: "Vendedor externo",
  supervisor: "Supervisor/Gestor",
  administrador: "Administrador",
  cliente: "Cliente final",
};

/** Página inicial de cada papel após o login (docs/PAGINAS.md → /login). */
export function homeForRole(_role?: string | null): "/indicadores" {
  return "/indicadores";
}

type AuthState = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  organizationName: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);

  async function loadProfile(userId: string | undefined) {
    if (!userId) {
      setProfile(null);
      setOrganizationName(null);
      return;
    }
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(data ?? null);
    if (data) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", data.organization_id)
        .maybeSingle();
      setOrganizationName(org?.name ?? null);
    }
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Defer to avoid calling Supabase inside the auth callback.
      setTimeout(() => {
        void loadProfile(s?.user.id).finally(() => setReady(true));
      }, 0);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void loadProfile(data.session?.user.id).finally(() => setReady(true));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    ready,
    session,
    profile,
    organizationName,
    refreshProfile: () => loadProfile(session?.user.id),
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
