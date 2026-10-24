import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { canCreateOrder, ERP_STATUS_LABEL, ORDER_STATUS_LABEL, ORIGIN_LABEL, orderNumber } from "@/lib/orders";
import { PageHeader } from "@/components/ModulePage";
import { EmptyState, ErrorState, RowsSkeleton, brl } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/pedidos/")({
  head: () => ({
    meta: [
      { title: "Pedidos — Dcalice" },
      { name: "description", content: "Pedidos da sua carteira com status, origem e sincronização com o ERP." },
      { property: "og:title", content: "Pedidos — Dcalice" },
      { property: "og:description", content: "Pedidos da sua carteira com status, origem e sincronização com o ERP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const { profile } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("todos");
  const [origin, setOrigin] = useState("todas");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const list = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, created_at, status, origin, total_amount, erp_sync_status, customers(name)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const term = q.trim().toLowerCase();
  const rows = (list.data ?? []).filter(
    (o) =>
      (status === "todos" || o.status === status) &&
      (origin === "todas" || o.origin === origin) &&
      (!from || o.created_at.slice(0, 10) >= from) &&
      (!to || o.created_at.slice(0, 10) <= to) &&
      (!term || (o.customers?.name ?? "").toLowerCase().includes(term) || orderNumber(o.id).toLowerCase().includes(term)),
  );
  const counts = (list.data ?? []).reduce<Record<string, number>>((acc, o) => ((acc[o.status] = (acc[o.status] ?? 0) + 1), acc), {});

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Pedidos" description="Pedidos de vendedor e do E-commerce no mesmo fluxo." />
        {canCreateOrder(profile?.role) && (
          <Button asChild><Link to="/pedidos/novo"><Plus className="h-4 w-4" /> Novo pedido</Link></Button>
        )}
      </div>

      {!!list.data?.length && (
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(ORDER_STATUS_LABEL).map(([k, label]) => (
            <button key={k} onClick={() => setStatus(status === k ? "todos" : k)}
              className={`rounded-md border px-3 py-1.5 text-sm ${status === k ? "border-primary bg-secondary" : "bg-card"}`}>
              {label} <span className="font-semibold tabular-nums">{counts[k] ?? 0}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_180px_160px_150px_150px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar cliente ou número" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(ORDER_STATUS_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={origin} onValueChange={setOrigin}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as origens</SelectItem>
            <SelectItem value="vendedor">Vendedor</SelectItem>
            <SelectItem value="ecommerce">E-commerce</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" aria-label="De" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" aria-label="Até" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {list.isLoading ? (
        <RowsSkeleton />
      ) : list.isError ? (
        <ErrorState message="Não foi possível carregar os pedidos" onRetry={() => list.refetch()} />
      ) : !list.data?.length ? (
        <EmptyState title="Nenhum pedido ainda">
          {canCreateOrder(profile?.role) && <Link to="/pedidos/novo" className="font-medium text-primary underline">Criar o primeiro pedido</Link>}
        </EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState title="Nenhum pedido com esses filtros" />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {rows.map((o) => (
            <li key={o.id}>
              <Link to="/pedidos/$id" params={{ id: o.id }} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/50">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{o.customers?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {orderNumber(o.id)} · {new Date(o.created_at).toLocaleDateString("pt-BR")} · {ORIGIN_LABEL[o.origin]}
                  </p>
                </div>
                <Badge variant="outline" className="hidden sm:inline-flex">{ERP_STATUS_LABEL[o.erp_sync_status]}</Badge>
                <span className="text-sm font-semibold tabular-nums">{brl(o.total_amount)}</span>
                <Badge variant={o.status === "recusado" || o.status === "cancelado" ? "destructive" : o.status === "aguardando_aprovacao" ? "outline" : "secondary"}>
                  {ORDER_STATUS_LABEL[o.status]}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
