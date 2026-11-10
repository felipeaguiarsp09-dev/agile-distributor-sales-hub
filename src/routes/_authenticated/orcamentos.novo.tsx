import { redirect, createFileRoute, useNavigate } from "@tanstack/react-router";
import { OrderBuilder } from "@/components/OrderBuilder";

type Search = { cliente?: string | undefined; rascunho?: string | undefined; repetir?: string | undefined };

export const Route = createFileRoute("/_authenticated/orcamentos/novo")({
  // Oculto: o app só cria pedidos; cadastros e demais módulos ficam com o ERP.
  beforeLoad: () => { throw redirect({ to: "/pedidos" }); },
  validateSearch: (s: Record<string, unknown>): Search => ({
    cliente: typeof s["cliente"] === "string" ? s["cliente"] : undefined,
    rascunho: typeof s["rascunho"] === "string" ? s["rascunho"] : undefined,
    repetir: typeof s["repetir"] === "string" ? s["repetir"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Novo orçamento — Dcalice" },
      { name: "description", content: "Monte uma proposta com o catálogo e a validade, e converta em pedido quando o cliente aceitar." },
      { property: "og:title", content: "Novo orçamento — Dcalice" },
      { property: "og:description", content: "Monte uma proposta com o catálogo e a validade, e converta em pedido quando o cliente aceitar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewQuote,
});

function NewQuote() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  return (
    <OrderBuilder
      mode="orcamento"
      initialCustomerId={search.cliente}
      resumeId={search.rascunho}
      repeatOrderId={search.repetir}
      onRepeatConsumed={() => navigate({ to: "/orcamentos/novo", search: (prev: Search) => ({ ...prev, repetir: undefined }), replace: true })}
      onConfirmed={() => {}}
      onQuoteSaved={() => navigate({ to: "/orcamentos" })}
    />
  );
}
