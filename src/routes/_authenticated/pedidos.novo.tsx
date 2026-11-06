import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { OrderBuilder } from "@/components/OrderBuilder";

type Search = { cliente?: string | undefined; rascunho?: string | undefined; repetir?: string | undefined };

export const Route = createFileRoute("/_authenticated/pedidos/novo")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    cliente: typeof s["cliente"] === "string" ? s["cliente"] : undefined,
    rascunho: typeof s["rascunho"] === "string" ? s["rascunho"] : undefined,
    repetir: typeof s["repetir"] === "string" ? s["repetir"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Novo pedido — Dcalice" },
      { name: "description", content: "Monte o pedido com o catálogo, o histórico de compras e sugestões da IA." },
      { property: "og:title", content: "Novo pedido — Dcalice" },
      { property: "og:description", content: "Monte o pedido com o catálogo, o histórico de compras e sugestões da IA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewOrder,
});

function NewOrder() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  return (
    <OrderBuilder
      mode="pedido"
      initialCustomerId={search.cliente}
      resumeId={search.rascunho}
      repeatOrderId={search.repetir}
      onRepeatConsumed={() => navigate({ to: "/pedidos/novo", search: (prev: Search) => ({ ...prev, repetir: undefined }), replace: true })}
      onConfirmed={(id) => navigate({ to: "/pedidos/$id", params: { id } })}
      onQuoteSaved={() => {}}
    />
  );
}
