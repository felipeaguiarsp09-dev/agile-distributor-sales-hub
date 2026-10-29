import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ORDER_STATUS_LABEL, ORIGIN_LABEL, canCreateOrder, orderNumber } from "@/lib/orders";
import { orderHistoryWindow } from "@/lib/order-history";
import { PageHeader } from "@/components/ModulePage";
import { EmptyState, ErrorState, RowsSkeleton, brl } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE_SIZE = 20;

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({
    meta: [
      { title: "Histórico de pedidos — Dcalice" },
      { name: "description", content: "Pedidos feitos pelos clientes nos últimos 12 meses." },
      { property: "og:title", content: "Histórico de pedidos — Dcalice" },
      { property: "og:description", content: "Pedidos feitos pelos clientes nos últimos 12 meses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrderHistoryPage,
});

function OrderHistoryPage() {
  const { profile } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("todos");
  const [customerId, setCustomerId] = useState("todos");
  const [page, setPage] = useState(0);
  const [historyWindow] = useState(() => orderHistoryWindow());

  const customers = useQuery({
    queryKey: ["history-customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const term = q.trim();
  const list = useQuery({
    queryKey: ["order-history", term, status, customerId, page, historyWindow.from],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("id, created_at, status, origin, total_amount, seller_id, customers!inner(name)", { count: "exact" })
        .gte("created_at", historyWindow.from)
        .lte("created_at", historyWindow.to)
        .neq("status", "rascunho")
        .order("created_at", { ascending: false });
      if (status !== "todos") query = query.eq("status", status);
      if (customerId !== "todos") query = query.eq("customer_id", customerId);
      if (term) query = query.ilike("customers.name", `%${term}%`);
      const { data, error, count } = await query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: data, total: count ?? 0 };
    },
  });

  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE));
  const resetPage = () => setPage(0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Histórico de pedidos"
        description="Pedidos feitos pelos clientes nos últimos 12 meses."
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_220px_200px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por cliente"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              resetPage();
            }}
          />
        </div>
        <Select
          value={customerId}
          onValueChange={(v) => {
            setCustomerId(v);
            resetPage();
          }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os clientes</SelectItem>
            {(customers.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            {Object.entries(ORDER_STATUS_LABEL).map(([k, l]) => (
              <SelectItem key={k} value={k}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {list.isLoading ? (
        <RowsSkeleton />
      ) : list.isError ? (
        <ErrorState message="Não foi possível carregar o histórico" onRetry={() => list.refetch()} />
      ) : !list.data?.rows.length ? (
        <EmptyState title="Nenhum pedido nos últimos 12 meses com esses filtros" />
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
