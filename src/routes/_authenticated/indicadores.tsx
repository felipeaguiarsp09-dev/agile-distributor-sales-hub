import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePage";

export const Route = createFileRoute("/_authenticated/indicadores")({
  head: () => ({
    meta: [
      { title: "Indicadores — Dcalice" },
      { name: "description", content: "Meta, vendas do mês e ticket médio com análise da IA." },
      { property: "og:title", content: "Indicadores — Dcalice" },
      { property: "og:description", content: "Meta, vendas do mês e ticket médio com análise da IA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ModulePlaceholder title="Indicadores" description="Meta, vendas do mês e ticket médio com análise da IA." icon={BarChart3} />,
});
