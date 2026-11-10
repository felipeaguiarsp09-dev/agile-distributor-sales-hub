import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogOut, Menu, Plug, Settings, Upload, UserCog } from "lucide-react";

const ADMIN_LINKS = [
  { to: "/admin/usuarios", label: "Usuários", icon: UserCog },
  { to: "/admin/integracoes", label: "Integrações", icon: Plug },
  { to: "/admin/importacao", label: "Importação", icon: Upload },
] as const;
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABEL, useAuth, type Role } from "@/lib/auth";
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
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "!bg-sidebar-primary !text-sidebar-primary-foreground shadow-sm" }}
        >
          <m.icon className="h-4 w-4" />
          {m.label}
        </Link>
      ))}
    </nav>
  );
}

function SignOutButton({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }
  return (
    <button onClick={handleSignOut} className={className}>
      <LogOut className="h-4 w-4" /> Sair
    </button>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const { profile, organizationName } = useAuth();
  return (
    <div className="flex h-full flex-col gap-6 overflow-hidden p-4">
      <div className="px-2 pt-2">
        <Brand inverted />
      </div>
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        <NavList onNavigate={onNavigate} />
      </div>
      <div className="space-y-1 border-t border-sidebar-border pt-4">
        {profile?.role === "administrador" &&
          ADMIN_LINKS.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "!bg-sidebar-primary !text-sidebar-primary-foreground shadow-sm" }}
            >
              <a.icon className="h-4 w-4" /> {a.label}
            </Link>
          ))}
        <Link
          to="/configuracoes"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{ className: "!bg-sidebar-primary !text-sidebar-primary-foreground shadow-sm" }}
        >
          <Settings className="h-4 w-4" /> Configurações
        </Link>
        <div className="px-3 py-2">
          <p className="truncate text-sm font-semibold text-sidebar-foreground">{profile?.full_name}</p>
          <p className="truncate text-xs text-sidebar-foreground/60">
            {profile ? ROLE_LABEL[profile.role as Role] : ""} · {organizationName}
          </p>
        </div>
        <SignOutButton className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
      </div>
    </div>
  );
}

function AppShell() {
  const { ready, session, profile } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);

  // Oculta o cabeçalho ao rolar para baixo e mostra ao rolar para cima.
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 60) setHeaderHidden(false);
      else if (y > last + 4) setHeaderHidden(true);
      else if (y < last - 4) setHeaderHidden(false);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // O E-commerce foi removido: clientes finais não têm mais acesso ao app.
  useEffect(() => {
    if (!ready) return;
    if (!session) {
      navigate({ to: "/login", replace: true });
      return;
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

  if (profile.role === "cliente") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">O acesso de clientes não está disponível. Fale com o seu vendedor da Dcalice.</p>
        <SignOutButton className="rounded-md border px-4 py-2 text-sm font-medium" />
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
        <header className={`sticky top-0 z-10 flex transition-transform lg:hidden duration-200 ${headerHidden ? "-translate-y-full" : "translate-y-0"}`}
          data-hidden={headerHidden}
        >
          <div className="flex w-full items-center gap-3 border-b bg-card/85 px-3 py-2.5 shadow-sm backdrop-blur-md lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </Button>
          <Brand />
          <SignOutButton className="ml-auto inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent" />
          </div>
        </header>
        <main className="flex-1 px-4 pb-24 pt-5 sm:px-8 sm:py-8 lg:pb-8">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}

/** Barra inferior para uso em campo no celular (atalhos aos módulos principais). */
function BottomNav() {
  const { profile } = useAuth();
  const items = modulesForRole(profile?.role).slice(0, 4);
  if (!items.length) return null;
  return (
    <nav aria-label="Atalhos" className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-card backdrop-blur-md lg:hidden">
      <div className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((m) => (
          <Link key={m.to} to={m.to}
            className="flex min-w-0 flex-col items-center gap-1 px-1 py-2 text-[11px] font-medium text-muted-foreground transition-colors"
            activeProps={{ className: "!text-primary" }}>
            <m.icon className="h-5 w-5 shrink-0" />
            <span className="w-full truncate text-center">{m.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
