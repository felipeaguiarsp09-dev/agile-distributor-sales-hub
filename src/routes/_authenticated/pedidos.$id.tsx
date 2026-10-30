import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Check, Copy, Pencil, RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { canCreateOrder, ERP_STATUS_LABEL, ORDER_STATUS_LABEL, ORIGIN_LABEL, orderNumber } from "@/lib/orders";
import { pushOrderToErp } from "@/lib/orders.functions";
import { ErrorState, RowsSkeleton, brl } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/pedidos/$id")({
  head: () => ({
    meta: [
      { title: "Pedido — Dcalice" },
      { name: "description", content: "Itens, status, aprovação e sincronização do pedido com o ERP." },
      { property: "og:title", content: "Pedido — Dcalice" },
      { property: "og:description", content: "Itens, status, aprovação e sincronização do pedido com o ERP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrderDetail,
});

const STEPS = ["rascunho", "aguardando_aprovacao", "aprovado", "faturado"];

function OrderDetail() {
  const { id } = Route.useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pushFn = useServerFn(pushOrderToErp);
  const [busy, setBusy] = useState(false);

  const order = useQuery({
    queryKey: ["orders", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, customers(id, name), seller:profiles!orders_seller_id_fkey(full_name), approver:profiles!orders_approved_by_fkey(full_name), order_items(id, product_id, quantity, unit_price, line_total, was_ai_suggested, products(name, sku))")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (order.isLoading) return <div className="mx-auto max-w-4xl"><RowsSkeleton rows={4} /></div>;
  if (order.isError) return <ErrorState message="Falha ao carregar o pedido" onRetry={() => order.refetch()} />;
  const o = order.data;
  if (!o) return <ErrorState message="Pedido não encontrado" />;

  const role = profile?.role;
  const isOwner = o.seller_id === profile?.id;
  const canApprove = (role === "supervisor" || role === "administrador") && o.status === "aguardando_aprovacao";
  const canEdit = o.status === "rascunho" && (isOwner || role === "administrador");
  const canCancel = role === "administrador" && !["cancelado", "faturado"].includes(o.status);
  const canPush = (role === "supervisor" || role === "administrador") && ["aprovado", "faturado"].includes(o.status) && !o.erp_order_id;
  const canManage = canCreateOrder(role) && (isOwner || role === "administrador");
  const canRepeat = canManage && ["aprovado", "faturado"].includes(o.status);
  const canRestart = canManage && o.status === "recusado";

  async function copyToDraft() {
    setBusy(true);
    try {
      if (!profile || !o) throw new Error("Sem sessão ativa");
      const { data: created, error } = await supabase
        .from("orders")
        .insert({ organization_id: o.organization_id, customer_id: o.customer_id, seller_id: profile.id, origin: "vendedor", discount_amount: o.discount_amount, notes: o.notes })
        .select("id")
        .single();
      if (error) throw new Error("Não foi possível copiar o pedido");
      const { error: itemsErr } = await supabase.from("order_items").insert(
        o.order_items.map((i) => ({ order_id: created.id, product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price, line_total: i.line_total, was_ai_suggested: i.was_ai_suggested })),
      );
      if (itemsErr) throw new Error("Não foi possível copiar os itens");
      toast.success("Pedido copiado para um novo rascunho");
      await qc.invalidateQueries({ queryKey: ["orders"] });
      navigate({ to: "/pedidos/novo", search: { rascunho: created.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao copiar o pedido");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: string, msg: string) {
    setBusy(true);
    const patch: { status: string; approved_by?: string; approved_at?: string } = { status };
    if (role === "administrador" && (status === "aprovado" || status === "recusado")) {
      patch.approved_by = profile!.id;
      patch.approved_at = new Date().toISOString();
    }
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success(msg);
    await qc.invalidateQueries({ queryKey: ["orders"] });
  }

  async function push() {
    setBusy(true);
    try {
      const res = await pushFn({ data: { order_id: id } });
      toast[res.ok ? "success" : "error"](res.message);
      await qc.invalidateQueries({ queryKey: ["orders", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar ao ERP");
    } finally {
      setBusy(false);
    }
  }

  const reached = (s: string) => STEPS.indexOf(o.status) >= STEPS.indexOf(s) && STEPS.includes(o.status);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        to="/pedidos"
        search={(prev) => prev}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Pedidos
      </Link>
      <div className="mb-6 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">Pedido {orderNumber(o.id)} · {ORIGIN_LABEL[o.origin]}</p>
          <h1 className="text-2xl font-bold sm:text-3xl">
            {o.customers ? <Link to="/clientes/$id" params={{ id: o.customers.id }} className="hover:underline">{o.customers.name}</Link> : "Cliente"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vendedor: {o.seller?.full_name ?? "—"} · {new Date(o.created_at).toLocaleString("pt-BR")}
          </p>
        </div>
        <Badge className="text-sm" variant={o.status === "recusado" || o.status === "cancelado" ? "destructive" : "secondary"}>{ORDER_STATUS_LABEL[o.status]}</Badge>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {canEdit && <Button asChild variant="outline"><Link to="/pedidos/novo" search={{ rascunho: o.id }}><Pencil className="h-4 w-4" /> Continuar edição</Link></Button>}
        {canRepeat && <Button asChild variant="outline"><Link to="/pedidos/novo" search={{ repetir: o.id }}><RefreshCw className="h-4 w-4" /> Pedir de novo</Link></Button>}
        {canRestart && <Button disabled={busy} variant="outline" onClick={copyToDraft}><Copy className="h-4 w-4" /> Editar em novo rascunho</Button>}
        {canApprove && (
          <>
            <Button disabled={busy} onClick={() => setStatus("aprovado", "Pedido aprovado")}><Check className="h-4 w-4" /> Aprovar</Button>
            <Button disabled={busy} variant="outline" onClick={() => setStatus("recusado", "Pedido recusado")}><X className="h-4 w-4" /> Recusar</Button>
          </>
        )}
        {canCancel && <Button disabled={busy} variant="ghost" onClick={() => confirm("Cancelar este pedido?") && setStatus("cancelado", "Pedido cancelado")}>Cancelar pedido</Button>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <section className="rounded-lg border bg-card p-5 sm:col-span-2">
          <h2 className="mb-3 font-semibold">Itens</h2>
          <ul className="divide-y text-sm">
            {o.order_items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{i.products?.name}{i.was_ai_suggested && <Badge variant="outline" className="ml-2 gap-1"><Sparkles className="h-3 w-3" /> Sugestão da IA</Badge>}</p>
                  <p className="text-xs text-muted-foreground">{i.products?.sku} · {i.quantity} × {brl(i.unit_price)}</p>
                </div>
                <span className="tabular-nums">{brl(i.line_total)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between"><span>Desconto</span><span className="tabular-nums">− {brl(o.discount_amount)}</span></div>
            <div className="flex justify-between text-base font-bold"><span>Total</span><span className="tabular-nums">{brl(o.total_amount)}</span></div>
          </div>
          {o.notes && <p className="mt-3 rounded-md bg-muted p-3 text-sm">{o.notes}</p>}
        </section>

        <div className="space-y-4">
          <section className="rounded-lg border bg-card p-5">
            <h2 className="mb-3 font-semibold">Status</h2>
            <ol className="space-y-2 text-sm">
              {STEPS.map((s) => (
                <li key={s} className={reached(s) ? "font-medium" : "text-muted-foreground"}>
                  <span className={`mr-2 inline-block h-2 w-2 rounded-full ${reached(s) ? "bg-primary" : "bg-muted"}`} />
                  {ORDER_STATUS_LABEL[s]}
                </li>
              ))}
              {(o.status === "recusado" || o.status === "cancelado") && <li className="font-medium text-destructive">{ORDER_STATUS_LABEL[o.status]}</li>}
            </ol>
            {o.approved_at && (
              <p className="mt-3 text-xs text-muted-foreground">
                {o.status === "recusado" ? "Recusado" : "Aprovado"} {o.approver?.full_name ? `por ${o.approver.full_name}` : "automaticamente"} em {new Date(o.approved_at).toLocaleString("pt-BR")}
              </p>
            )}
            {o.needs_approval && <p className="mt-1 text-xs text-muted-foreground">Exigiu aprovação (desconto ou crédito do cliente).</p>}
          </section>

          <section className={`rounded-lg border bg-card p-5 ${o.erp_sync_status === "erro" ? "border-destructive" : ""}`}>
            <h2 className="mb-2 font-semibold">ERP</h2>
            <Badge variant={o.erp_sync_status === "erro" ? "destructive" : "outline"}>{ERP_STATUS_LABEL[o.erp_sync_status]}</Badge>
            {o.erp_order_id && <p className="mt-2 text-sm">Nº no ERP: {o.erp_order_id}</p>}
            {canPush && (
              <Button className="mt-3 w-full" size="sm" variant="outline" disabled={busy} onClick={push}>
                <RefreshCw className="h-4 w-4" /> {o.erp_sync_status === "erro" ? "Reenviar ao ERP" : "Enviar ao ERP"}
              </Button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
