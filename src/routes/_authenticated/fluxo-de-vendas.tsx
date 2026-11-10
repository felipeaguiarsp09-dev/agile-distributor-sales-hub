import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Check, Radio, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ORDER_STATUS_LABEL, orderNumber, erpOrderNumber } from "@/lib/orders";
import { PageHeader } from "@/components/ModulePage";
import { brl, CreditBadge, EmptyState, ErrorState, NoAccess, RowsSkeleton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/fluxo-de-vendas")({
  head: () => ({
    meta: [
      { title: "Fluxo de Vendas — Dcalice" },
      { name: "description", content: "Pedidos por status, vendedor e região em tempo real, com aprovação do supervisor." },
      { property: "og:title", content: "Fluxo de Vendas — Dcalice" },
      { property: "og:description", content: "Pedidos por status, vendedor e região em tempo real, com aprovação do supervisor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalesFlowPage,
});

const FLOW = ["em_aberto", "faturado", "entregue", "recusado", "cancelado"];
const OPEN_STATUSES = new Set(["rascunho", "aguardando_aprovacao", "aprovado"]);
const FLOW_LABEL: Record<string, string> = { em_aberto: "Em aberto" };
type Row = { status: string; seller_id: string | null; seller_name: string; region: string; orders_count: number; total_amount: number };

function range(p: string): { p_from?: string } {
  const d = new Date();
  if (p === "hoje") d.setHours(0, 0, 0, 0);
  else if (p === "7d") d.setDate(d.getDate() - 7);
  else if (p === "mes") d.setDate(1), d.setHours(0, 0, 0, 0);
  else return {};
  return { p_from: d.toISOString() };
}

function SalesFlowPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [period, setPeriod] = useState("mes");
  const [group, setGroup] = useState<"seller" | "region">("seller");
  const [busy, setBusy] = useState<string | null>(null);
  const role = profile?.role;
  const allowed = role === "vendedor" || role === "supervisor" || role === "administrador";
  // Aprovação de pedidos é feita no ERP; o app não aprova nem recusa.
  const canApprove = false as boolean;

  const flow = useQuery({
    queryKey: ["orders", "flow", period],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sales_flow", range(period));
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, orders_count: Number(r.orders_count), total_amount: Number(r.total_amount) })) as Row[];
    },
  });

  const pending = useQuery({
    queryKey: ["orders", "pending-approval"],
    enabled: canApprove,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, erp_order_id, total_amount, discount_amount, created_at, customers(name, credit_status), seller:profiles!orders_seller_id_fkey(full_name)")
        .eq("status", "aguardando_aprovacao")
        .eq("needs_approval", true)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  // Tempo real: qualquer mudança em pedidos visíveis (RLS) atualiza o fluxo.
  useEffect(() => {
    if (!allowed) return;
    const channel = supabase
      .channel(`sales-flow-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        void qc.invalidateQueries({ queryKey: ["orders"] });
      })
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [allowed, qc]);

  const byStatus = useMemo(() => {
    const m = new Map<string, { count: number; total: number; groups: Map<string, { count: number; total: number }> }>();
    for (const r of flow.data ?? []) {
      const status = OPEN_STATUSES.has(r.status) ? "em_aberto" : r.status;
      const s = m.get(status) ?? { count: 0, total: 0, groups: new Map() };
      s.count += r.orders_count;
      s.total += r.total_amount;
      const key = group === "seller" ? r.seller_name : r.region;
      const g = s.groups.get(key) ?? { count: 0, total: 0 };
      g.count += r.orders_count;
      g.total += r.total_amount;
      s.groups.set(key, g);
      m.set(status, s);
    }
    return m;
  }, [flow.data, group]);

  if (!allowed) return <NoAccess />;

  async function decide(id: string, status: "aprovado" | "recusado") {
    setBusy(id);
    const patch: { status: string; approved_by?: string; approved_at?: string } = { status };
    if (role === "administrador") {
      patch.approved_by = profile!.id;
      patch.approved_at = new Date().toISOString();
    }
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    setBusy(null);
    if (error) return void toast.error(error.message);
    toast.success(status === "aprovado" ? "Pedido aprovado" : "Pedido recusado");
    await qc.invalidateQueries({ queryKey: ["orders"] });
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Fluxo de Vendas" description="Pedidos por status, vendedor e região, atualizados em tempo real." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="mes">Este mês</SelectItem>
            <SelectItem value="tudo">Todo o período</SelectItem>
          </SelectContent>
        </Select>
        <Select value={group} onValueChange={(v) => setGroup(v as "seller" | "region")}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="seller">Agrupar por vendedor</SelectItem>
            <SelectItem value="region">Agrupar por região (UF)</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground"><Radio className="h-3 w-3 text-primary" /> Ao vivo</span>
      </div>

      {canApprove && (
        <section className="mb-6 rounded-lg border bg-card p-5">
          <h2 className="mb-3 font-semibold">Aguardando sua aprovação</h2>
          {pending.isLoading ? (
            <RowsSkeleton rows={2} />
          ) : pending.isError ? (
            <ErrorState message="Não foi possível carregar os pedidos pendentes" onRetry={() => pending.refetch()} />
          ) : !pending.data?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido aguardando aprovação.</p>
          ) : (
            <ul className="divide-y">
              {pending.data.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <Link to="/pedidos/$id" params={{ id: o.id }} className="block break-words font-medium hover:underline">{erpOrderNumber(o.erp_order_id)} · {o.customers?.name}</Link>
                    <p className="text-xs text-muted-foreground">Ref. interna {orderNumber(o.id)}</p>
                    <p className="text-sm text-muted-foreground">
                      {o.seller?.full_name ?? "E-commerce"} · {brl(Number(o.total_amount))}
                      {Number(o.discount_amount) > 0 && ` · desconto ${brl(Number(o.discount_amount))}`}
                    </p>
                  </div>
                  {o.customers?.credit_status && o.customers.credit_status !== "ok" && <CreditBadge status={o.customers.credit_status} />}
                  <Button size="sm" variant="outline" disabled={busy === o.id} onClick={() => decide(o.id, "recusado")}><X className="h-4 w-4" /> Recusar</Button>
                  <Button size="sm" disabled={busy === o.id} onClick={() => decide(o.id, "aprovado")}><Check className="h-4 w-4" /> Aprovar</Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {flow.isLoading ? (
        <RowsSkeleton rows={4} />
      ) : flow.isError ? (
        <ErrorState message="Não foi possível carregar o fluxo de vendas" onRetry={() => flow.refetch()} />
      ) : !flow.data?.length ? (
        <EmptyState title="Nenhum pedido no período">Os pedidos aparecem aqui assim que forem criados.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FLOW.map((s) => {
            const col = byStatus.get(s);
            return (
              <section key={s} className="rounded-lg border bg-card p-4">
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="flex-1 font-semibold">{FLOW_LABEL[s] ?? ORDER_STATUS_LABEL[s] ?? s}</h3>
                  <Badge variant={s === "recusado" || s === "cancelado" ? "destructive" : "secondary"} className={s === "faturado" || s === "entregue" ? "border-transparent bg-success text-success-foreground" : undefined}>{col?.count ?? 0}</Badge>
                </div>
                <p className={`mb-3 text-lg font-semibold tabular-nums ${(s === "faturado" || s === "entregue") && (col?.total ?? 0) > 0 ? "text-success" : ""}`}>{brl(col?.total ?? 0)}</p>
                {col ? (
                  <ul className="space-y-1 text-sm">
                    {[...col.groups.entries()].sort((a, b) => b[1].total - a[1].total).map(([k, g]) => (
                      <li key={k} className="flex justify-between gap-2">
                        <span className="truncate text-muted-foreground">{k}</span>
                        <span className="tabular-nums">{g.count} · {brl(g.total)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem pedidos</p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
