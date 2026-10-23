import { createFileRoute } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePage";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos — VendaForte" },
      { name: "description", content: "Catálogo, preços e estoque." },
      { property: "og:title", content: "Produtos — VendaForte" },
      { property: "og:description", content: "Catálogo, preços e estoque." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ModulePlaceholder title="Produtos" description="Catálogo, preços e estoque." icon={Package} />,
});
