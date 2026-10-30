import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  canCreateOrder,
  ERP_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  ORIGIN_LABEL,
  orderNumber,
  orderNumberSearch,
  escapeSearchTerm,
} from "@/lib/orders";
import { orderHistoryWindow } from "@/lib/order-history";
import { PageHeader } from "@/components/ModulePage";
import { EmptyState, ErrorState, RowsSkeleton, brl } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE_SIZE = 20;

export const Route = createFileRoute("/_authenticated/pedidos/")({
  head: () => ({
    meta: [
      { title: "Pedidos — Dcalice" },
      { name: "description", content: "Pedidos da sua carteira nos últimos 12 meses, com status, origem e sincronização com o ERP." },
      { property: "og:title", content: "Pedidos — Dcalice" },
      { property: "og:description", content: "Pedidos da sua carteira nos últimos 12 meses, com status, origem e sincronização com o ERP." },
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
  const [page, setPage] = useState(0);
  const [historyWindow] = useState(() => orderHistoryWindow());

  const term = q.trim();
  const numberRange = orderNumberSearch(term);
  const like = `%${escapeSearchTerm(term)}%`;

  const list = useQuery({
    queryKey: ["orders", term, status, origin, from, to, page, historyWindow.from],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("id, created_at, status, origin, total_amount, erp_sync_status, seller_id, customers!inner(name)", { count: "exact" })
        .gte("created_at", historyWindow.from)
        .lte("created_at", historyWindow.to)
        .order("created_at", { ascending: false });
      if (status !== "todos") query = query.eq("status", status);
      if (origin !== "todas") query = query.eq("origin", origin);
      if (from) query = query.gte("created_at", `${from}T00:00:00`);
      if (to) query = query.lte("created_at", `${to}T23:59:59`);
      if (term) {
        query = numberRange
          ? query.or(`customers.name.ilike.${like},and(id.gte.${numberRange.gte},id.lt.${numberRange.lt})`)
          : query.ilike("customers.name", like);
      }
      const { data, error, count } = await query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: data, total: count ?? 0 };
    },
  });

  const counts = useQuery({
    queryKey: ["orders-counts", term, origin, from, to, historyWindow.from],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("status, customers!inner(name)")
        .gte("created_at", historyWindow.from)
        .lte("created_at", historyWindow.to);
      if (origin !== "todas") query = query.eq("origin", origin);
      if (from) query = query.gte("created_at", `${from}T00:00:00`);
      if (to) query = query.lte("created_at", `${to}T23:59:59`);
      if (term) {
        query = numberRange
          ? query.or(`customers.name.ilike.${like},and(id.gte.${numberRange.gte},id.lt.${numberRange.lt})`)
          : query.ilike("customers.name", like);
      }
      const { data, error } = await query.range(0, 9999);
      if (error) throw error;
      return (data ?? []).reduce<Record<string, number>>((acc, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc), {});
    },
  });

  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE));
  const resetPage = () => setPage(0);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Pedidos"
          description="Pedidos de vendedor e do E-commerce nos últimos 12 meses, no mesmo fluxo."
        />
        {canCreateOrder(profile?.role) && (
          <Button asChild><Link to="/pedidos/novo"><Plus className="h-4 w-4" /> Novo pedido</Link></Button>
        )}
      </div>

      {!!counts.data && Object.values(counts.data).some((n) => n > 0) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(ORDER_STATUS_LABEL).map(([k, label]) => (
            <button
              key={k}
              onClick={() => {
                setStatus(status === k ? "todos" : k);
                resetPage();
              }}
              className={`rounded-md border px-3 py-1.5 text-sm ${status === k ? "border-primary bg-secondary" : "bg-card"}`}
            >
              {label} <span className="font-semibold tabular-nums">{counts.data?.[k] ?? 0}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_180px_160px_150px_150px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar cliente ou número"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              resetPage();
            }}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            resetPage();
          }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(ORDER_STATUS_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select
          value={origin}
          onValueChange={(v) => {
            setOrigin(v);
            resetPage();
          }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as origens</SelectItem>
            <SelectItem value="vendedor">Vendedor</SelectItem>
            <SelectItem value="ecommerce">E-commerce</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" aria-label="De" value={from} onChange={(e) => { setFrom(e.target.value); resetPage(); }} />
        <Input type="date" aria-label="Até" value={to} onChange={(e) => { setTo(e.target.value); resetPage(); }} />
      </div>

      {list.isLoading ? (
        <RowsSkeleton />
      ) : list.isError ? (
        <ErrorState message="Não foi possível carregar os pedidos" onRetry={() => list.refetch()} />
      ) : !list.data?.total ? (
        <EmptyState title="Nenhum pedido nos últimos 12 meses com esses filtros">
          {canCreateOrder(profile?.role) && <Link to="/pedidos/novo" className="font-medium text-primary underline">Criar o primeiro pedido</Link>}
        </EmptyState>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted-foreground">
            {list.data.total} pedido{list.data.total === 1 ? "" : "s"} encontrado{list.data.total === 1 ? "" : "s"}
          </p>
          <ul className="divide-y rounded-lg border bg-card">
            {list.data.rows.map((o) => {
              const canRepeat =
                canCreateOrder(profile?.role) &&
                (o.seller_id === profile?.id || profile?.role === "administrador") &&
                ["aprovado", "faturado"].includes(o.status);
              return (
                <li key={o.id} className="flex items-center gap-2 pr-2">
                  <Link
                    to="/pedidos/$id"
                    params={{ id: o.id }}
                    className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{o.customers?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {orderNumber(o.id)} · {new Date(o.created_at).toLocaleDateString("pt-BR")} · {ORIGIN_LABEL[o.origin]}
                      </p>
                    </div>
                    <Badge variant="outline" className="hidden sm:inline-flex">{ERP_STATUS_LABEL[o.erp_sync_status]}</Badge>
                    <span className="text-sm font-semibold tabular-nums">{brl(o.total_amount)}</span>
                    <Badge
                      variant={
                        o.status === "recusado" || o.status === "cancelado"
                          ? "destructive"
                          : o.status === "aguardando_aprovacao"
                            ? "outline"
                            : "secondary"
                      }
                    >
                      {ORDER_STATUS_LABEL[o.status]}
                    </Badge>
                  </Link>
                  {canRepeat && (
                    <Button asChild variant="outline" size="sm" className="shrink-0">
                      <Link to="/pedidos/novo" search={{ repetir: o.id }}>
                        <RefreshCw className="h-4 w-4" /> Pedir de novo
                      </Link>
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                Página {page + 1} de {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>
                Próxima <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
