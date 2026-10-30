import { createFileRoute, redirect } from "@tanstack/react-router";

/** O histórico dos últimos 12 meses foi unificado com a página de Pedidos. */
export const Route = createFileRoute("/_authenticated/historico")({
  beforeLoad: () => {
    throw redirect({ to: "/pedidos", replace: true });
  },
});
