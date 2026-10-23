import { createFileRoute } from "@tanstack/react-router";
import { KanbanSquare } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePage";

export const Route = createFileRoute("/_authenticated/fluxo-de-vendas")({
  head: () => ({
    meta: [
      { title: "Fluxo de Vendas — Dcalice" },
      { name: "description", content: "Pedidos por status em tempo real, com aprovação do supervisor." },
      { property: "og:title", content: "Fluxo de Vendas — Dcalice" },
      { property: "og:description", content: "Pedidos por status em tempo real, com aprovação do supervisor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ModulePlaceholder title="Fluxo de Vendas" description="Pedidos por status em tempo real, com aprovação do supervisor." icon={KanbanSquare} />,
});
