import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createPaymentIntent } from "@/lib/ecommerce.functions";
import { ORDER_STATUS_LABEL, orderNumber } from "@/lib/orders";
import { PageHeader } from "@/components/ModulePage";
import { brl, EmptyState, ErrorState, RowsSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/ecommerce/pedidos")({
  head: () => ({
    meta: [
      { title: "Meus pedidos — Dcalice" },
      { name: "description", content: "Acompanhe seus pedidos e pagamentos do e-commerce Dcalice." },
      { property: "og:title", content: "Meus pedidos — Dcalice" },
      { property: "og:description", content: "Acompanhe seus pedidos e pagamentos do e-commerce Dcalice." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyOrders,
});

const PAY_LABEL: Record<string, string> = { pendente: "Pagamento pendente", pago: "Pago", falhou: "Pagamento falhou", estornado: "Estornado" };

function MyOrders() {
  const payFn = useServerFn(createPaymentIntent);
  const [busy, setBusy] = useState<string | null>(null);
  const orders = useQuery({
    queryKey: ["orders", "ecommerce-mine"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders")
        .select("id, status, total_amount, created_at, payments(status, created_at), order_items(quantity, products(name))")
        .eq("origin", "ecommerce").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function pay(id: string) {
    setBusy(id);
    try {
      const r = await payFn({ data: { order_id: id } });
      if (r.checkout_url) window.location.href = r.checkout_url;
      else toast[r.status === "erro" ? "error" : "success"](r.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível iniciar o pagamento");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex-1"><PageHeader title="Meus pedidos" description="Situação de cada compra e do pagamento." /></div>
        <Button variant="outline" asChild><Link to="/ecommerce">Voltar à vitrine</Link></Button>
      </div>
      {orders.isLoading ? <RowsSkeleton rows={3} /> : orders.isError ? (
        <ErrorState message="Não foi possível carregar seus pedidos" onRetry={() => orders.refetch()} />
      ) : !orders.data?.length ? (
        <EmptyState title="Nenhum pedido ainda">Suas compras na vitrine aparecem aqui.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {orders.data.map((o) => {
            const last = [...(o.payments ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
            const canPay = last?.status !== "pago" && ["aprovado", "aguardando_aprovacao"].includes(o.status);
            return (
              <li key={o.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{orderNumber(o.id)}</span>
                  <span className="text-sm text-muted-foreground">{new Date(o.created_at).toLocaleDateString("pt-BR")}</span>
                  <Badge variant="secondary" className="ml-auto">{ORDER_STATUS_LABEL[o.status]}</Badge>
                  {last && <Badge variant={last.status === "pago" ? "default" : last.status === "falhou" ? "destructive" : "outline"}>{PAY_LABEL[last.status]}</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{o.order_items.map((i) => `${i.quantity}× ${i.products?.name}`).join(", ")}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-semibold tabular-nums">{brl(Number(o.total_amount))}</span>
                  {canPay && <Button size="sm" disabled={busy === o.id} onClick={() => pay(o.id)}>Pagar</Button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
