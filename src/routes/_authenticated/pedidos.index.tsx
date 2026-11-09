import { createFileRoute, Link, useNavigate, useElementScrollRestoration } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, Plus, RefreshCw, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  canCreateOrder,
  ERP_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_GROUPS,
  daysAgo,
  ORIGIN_LABEL,
  orderNumber,
  orderNumberSearch,
  orderListSearch,
  escapeSearchTerm,
} from "@/lib/orders";
import { orderHistoryWindow } from "@/lib/order-history";
import { getAppScrollRestorationKey } from "@/lib/order-scroll";
import { PageHeader } from "@/components/ModulePage";
import { EmptyState, ErrorState, RowsSkeleton, brl } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE_SIZE = 20;

// Filtros e página ficam na URL para sobreviverem à ida ao detalhe do pedido e à volta.
type Search = ReturnType<typeof orderListSearch>;

export const Route = createFileRoute("/_authenticated/pedidos/")({
  validateSearch: orderListSearch,
  head: () => ({
    meta: [
      { title: "Pedidos — Dcalice" },
      { name: "description", content: "Pedidos da sua carteira nos últimos 12 meses, com status e sincronização com o ERP." },
      { property: "og:title", content: "Pedidos — Dcalice" },
      { property: "og:description", content: "Pedidos da sua carteira nos últimos 12 meses, com status e sincronização com o ERP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const { profile } = useAuth();
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const savedScroll = useElementScrollRestoration({
    getElement: () => window,
    getKey: getAppScrollRestorationKey,
  });
  const restoreKey = JSON.stringify(search);
  const restoredKey = useRef<string | null>(null);
  const restorationTarget = useRef(savedScroll);
  const clearPending = useRef(false);
  const [historyWindow] = useState(() => orderHistoryWindow());

  const q = search.q ?? "";
  const status = search.status ?? "todos";
  const origin = search.origem ?? "todas";
  const from = search.de ?? "";
  const to = search.ate ?? "";
  const page = Math.max(0, (search.pagina ?? 1) - 1);

  const hasActiveFilters = !!(search.q || search.status || search.origem || search.de || search.ate);

  // Limpar volta à lista sem filtros, na primeira página e no topo.
  const clearFilters = () => {
    clearPending.current = true;
    navigate({ search: {}, replace: true });
  };

  // Qualquer mudança de filtro volta para a primeira página; só a paginação muda "pagina".
  const setFilters = (patch: Partial<Search>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch, pagina: undefined }), replace: true });
  const setPage = (p: number) =>
    navigate({ search: (prev) => ({ ...prev, pagina: p + 1 > 1 ? p + 1 : undefined }), replace: true });

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
      if (status !== "todos") query = query.in("status", ORDER_STATUS_GROUPS[status]?.statuses ?? [status]);
      if (origin !== "todas") query = query.eq("origin", origin);
      if (from) query = query.gte("created_at", `${from}T00:00:00`);
      if (to) query = query.lte("created_at", `${to}T23:59:59`);
      if (term) {
        // Número digitado busca pelo id do pedido; texto busca pelo nome do cliente.
        query = numberRange
          ? query.gte("id", numberRange.gte).lt("id", numberRange.lt)
          : query.ilike("customers.name_search", like);
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
        // Número digitado busca pelo id do pedido; texto busca pelo nome do cliente.
        query = numberRange
          ? query.gte("id", numberRange.gte).lt("id", numberRange.lt)
          : query.ilike("customers.name_search", like);
      }
      const { data, error } = await query.range(0, 9999);
      if (error) throw error;
      return (data ?? []).reduce<Record<string, number>>((acc, r) => { const g = Object.keys(ORDER_STATUS_GROUPS).find((k) => ORDER_STATUS_GROUPS[k]!.statuses.includes(r.status)); if (g) acc[g] = (acc[g] ?? 0) + 1; return acc; }, {});
    },
  });

  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE));

  useEffect(() => {
    restorationTarget.current = savedScroll;
    restoredKey.current = null;
  }, [restoreKey]);

  useEffect(() => {
    // Após limpar os filtros, a lista volta ao topo em vez de restaurar a rolagem anterior.
    if (clearPending.current && !list.isLoading) {
      clearPending.current = false;
      const frame = requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        restoredKey.current = restoreKey;
      });
      return () => cancelAnimationFrame(frame);
    }
    // Router restoration can run while the loading skeleton is still too short.
    // Reapply once the rows render, only once per list context, never on refetch.
    if (list.isLoading || restoredKey.current === restoreKey) return;
    const target = restorationTarget.current;
    const frame = requestAnimationFrame(() => {
      if (target) window.scrollTo({ top: target.scrollY, left: target.scrollX, behavior: "instant" });
      restoredKey.current = restoreKey;
    });
    return () => cancelAnimationFrame(frame);
  }, [list.isLoading, restoreKey]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Pedidos"
          description="Pedidos dos últimos 12 meses, no mesmo fluxo."
        />
        {canCreateOrder(profile?.role) && (
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild><Link to="/pedidos/novo"><Plus className="h-4 w-4" /> Novo pedido</Link></Button>
            <Button asChild variant="outline"><Link to="/orcamentos"><FileText className="h-4 w-4" /> Proposta comercial</Link></Button>
          </div>
        )}
      </div>

      {!!counts.data && Object.values(counts.data).some((n) => n > 0) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(ORDER_STATUS_GROUPS).map(([k, { label }]) => (
            <button
              key={k}
              onClick={() => setFilters({ status: status === k ? undefined : k })}
              className={`rounded-md border px-3 py-1.5 text-sm ${status === k ? "border-primary bg-secondary" : "bg-card"}`}
            >
              {label} <span className="font-semibold tabular-nums">{counts.data?.[k] ?? 0}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mb-2 flex flex-wrap gap-2">
        {[30, 90].map((n) => {
          const active = from === daysAgo(n) && !to;
          return (
            <Button key={n} variant={active ? "default" : "outline"} size="sm" className="min-h-11 md:min-h-9" onClick={() => setFilters({ de: active ? undefined : daysAgo(n), ate: undefined })}>
              {n} dias
            </Button>
          );
        })}
      </div>

      <div className="mb-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_150px_150px] lg:grid-cols-[minmax(0,1fr)_180px_150px_150px_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 pl-9 text-base md:h-9 md:text-sm"
            placeholder="Buscar cliente ou número"
            value={q}
            onChange={(e) => setFilters({ q: e.target.value || undefined })}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => setFilters({ status: v === "todos" ? undefined : v })}
        >
          <SelectTrigger className="h-11 text-base md:h-9 md:text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(ORDER_STATUS_GROUPS).map(([k, g]) => <SelectItem key={k} value={k}>{g.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" aria-label="De" className="h-11 text-base md:h-9 md:text-sm" value={from} onChange={(e) => setFilters({ de: e.target.value || undefined })} />
        <Input type="date" aria-label="Até" className="h-11 text-base md:h-9 md:text-sm" value={to} onChange={(e) => setFilters({ ate: e.target.value || undefined })} />
        <div className="flex items-center gap-2 md:col-span-full lg:col-span-1 lg:justify-end">
          {list.data && (
            <span className="whitespace-nowrap text-sm text-muted-foreground" aria-live="polite">
              {list.data.total} pedido{list.data.total === 1 ? "" : "s"}
            </span>
          )}
          {hasActiveFilters && (
            <Button
              variant="outline"
              aria-label="Limpar filtros"
              title="Limpar filtros"
              className="justify-center min-h-11 px-5 md:min-h-9 md:px-3 md:py-1"
              onClick={clearFilters}
            >
              <X className="h-4 w-4" /> Limpar
            </Button>
          )}
        </div>
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
          <ul className="divide-y rounded-lg border bg-card">
            {list.data.rows.map((o) => {
              const canRepeat =
                canCreateOrder(profile?.role) &&
                (o.seller_id === profile?.id || profile?.role === "administrador") &&
                ["aprovado", "faturado", "entregue"].includes(o.status);
              return (
                <li key={o.id} className="flex items-center gap-2 pr-2">
                  <Link
                    to="/pedidos/$id"
                    params={{ id: o.id }}
                    search={(prev) => prev}
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
                        <RefreshCw className="h-4 w-4" /> Clonar pedido
                      </Link>
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          {totalPages > 1 && (
            <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 whitespace-nowrap px-3 md:min-h-9 md:py-1 focus-visible:ring-4 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:text-muted-foreground disabled:opacity-100"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4 shrink-0" /> Anterior
              </Button>
              <span className="truncate text-center text-sm text-muted-foreground tabular-nums">
                Página{" "}
                <span className="rounded-md border bg-secondary px-1.5 py-0.5 font-semibold text-foreground">
                  {page + 1}
                </span>{" "}
                de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 whitespace-nowrap px-3 md:min-h-9 md:py-1 focus-visible:ring-4 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:text-muted-foreground disabled:opacity-100"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Próxima <ChevronRight className="h-4 w-4 shrink-0" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
