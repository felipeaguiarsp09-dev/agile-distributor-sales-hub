import { createFileRoute } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePage";

export const Route = createFileRoute("/_authenticated/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos — Dcalice" },
      { name: "description", content: "Pedidos da sua carteira ou equipe." },
      { property: "og:title", content: "Pedidos — Dcalice" },
      { property: "og:description", content: "Pedidos da sua carteira ou equipe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ModulePlaceholder title="Pedidos" description="Pedidos da sua carteira ou equipe." icon={ShoppingCart} />,
});
