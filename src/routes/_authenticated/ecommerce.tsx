import { createFileRoute } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePage";

export const Route = createFileRoute("/_authenticated/ecommerce")({
  head: () => ({
    meta: [
      { title: "E-commerce — Dcalice" },
      { name: "description", content: "Vitrine de produtos para pedidos do cliente." },
      { property: "og:title", content: "E-commerce — Dcalice" },
      { property: "og:description", content: "Vitrine de produtos para pedidos do cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ModulePlaceholder title="E-commerce" description="Vitrine de produtos para pedidos do cliente." icon={ShoppingBag} />,
});
