import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePage";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Dcalice" },
      { name: "description", content: "Carteira de clientes, limite de crédito e histórico." },
      { property: "og:title", content: "Clientes — Dcalice" },
      { property: "og:description", content: "Carteira de clientes, limite de crédito e histórico." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ModulePlaceholder title="Clientes" description="Carteira de clientes, limite de crédito e histórico." icon={Users} />,
});
