import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogOut, Menu, Settings } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABEL, homeForRole, useAuth, type Role } from "@/lib/auth";
import { modulesForRole } from "@/lib/modules";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: AppShell,
});

function NavList({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const { profile } = useAuth();
  const items = modulesForRole(profile?.role);
  return (
    <nav className="flex flex-col gap-1">
      {items.map((m) => (
        <Link
          key={m.to}
          to={m.to}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "bg-sidebar-accent text-sidebar-primary" }}
        >
          <m.icon className="h-4 w-4" />
          {m.label}
        </Link>
      ))}
    </nav>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const { profile, organizationName } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="px-2 pt-2">
        <Brand inverted />
      </div>
      <NavList onNavigate={onNavigate} />
      <div className="mt-auto space-y-1 border-t border-sidebar-border pt-4">
        <Link
          to="/configuracoes"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "bg-sidebar-accent text-sidebar-primary" }}
        >
          <Settings className="h-4 w-4" /> Configurações
        </Link>
        <div className="px-3 py-2">
          <p className="truncate text-sm font-semibold text-sidebar-foreground">{profile?.full_name}</p>
          <p className="truncate text-xs text-sidebar-foreground/60">
            {profile ? ROLE_LABEL[profile.role as Role] : ""} · {organizationName}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </div>
    </div>
  );
}

function AppShell() {
  const { ready, session, profile } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  // Cliente final só acessa E-commerce e Configurações.
  useEffect(() => {
    if (!ready) return;
    if (!session) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (profile?.role === "cliente" && !pathname.startsWith("/ecommerce") && pathname !== "/configuracoes") {
      navigate({ to: homeForRole("cliente"), replace: true });
    }
  }, [ready, session, profile, pathname, navigate]);

  if (!ready || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        {ready && session && !profile ? (
          <p className="max-w-sm text-center text-sm text-muted-foreground">
            Seu perfil ainda não foi configurado. Fale com o administrador da distribuidora.
          </p>
        ) : (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 bg-sidebar lg:block">
        <SidebarBody />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarBody onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </Button>
          <Brand />
        </header>
        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
