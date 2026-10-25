import { createFileRoute } from "@tanstack/react-router";
import { Plug } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePage";
import { NoAccess } from "@/components/shared";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/integracoes")({
  head: () => ({
    meta: [
      { title: "Integrações — Dcalice" },
      { name: "description", content: "Conexões com ERP, estoque, financeiro e pagamento." },
      { property: "og:title", content: "Integrações — Dcalice" },
      { property: "og:description", content: "Conexões com ERP, estoque, financeiro e pagamento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { profile } = useAuth();
  if (profile?.role !== "administrador") return <NoAccess />;
  return <ModulePlaceholder title="Integrações" description="Conexões com ERP, estoque, financeiro e pagamento." icon={Plug} />;
}
