import { createFileRoute } from "@tanstack/react-router";
import { UserCog } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePage";
import { NoAccess } from "@/components/shared";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — Dcalice" },
      { name: "description", content: "Cadastro de usuários, papéis e equipes de venda." },
      { property: "og:title", content: "Usuários — Dcalice" },
      { property: "og:description", content: "Cadastro de usuários, papéis e equipes de venda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { profile } = useAuth();
  if (profile?.role !== "administrador") return <NoAccess />;
  return <ModulePlaceholder title="Usuários" description="Cadastro de usuários, papéis e equipes de venda." icon={UserCog} />;
}
