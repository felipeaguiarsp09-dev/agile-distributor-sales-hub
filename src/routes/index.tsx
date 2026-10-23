import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { homeForRole, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dcalice — Força de Vendas para Distribuidoras" },
      { name: "description", content: "Acesse o Dcalice: pedidos, clientes, produtos, agenda e indicadores da sua distribuidora." },
      { property: "og:title", content: "Dcalice — Força de Vendas para Distribuidoras" },
      { property: "og:description", content: "Pedidos, clientes, produtos, agenda e indicadores em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { ready, session, profile } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!ready) return;
    if (!session) navigate({ to: "/login", replace: true });
    else navigate({ to: homeForRole(profile?.role), replace: true });
  }, [ready, session, profile, navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
