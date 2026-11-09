import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronLeft, ChevronRight, FileText, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { canCreateOrder, escapeSearchTerm, orderNumber, orderNumberSearch } from "@/lib/orders";
import { QUOTE_STATUS_LABEL, isQuoteExpired, quoteListSearch } from "@/lib/quotes";
import { convertQuoteToOrder } from "@/lib/quotes.functions";
import { PageHeader } from "@/components/ModulePage";
import { EmptyState, ErrorState, RowsSkeleton, brl } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE_SIZE = 20;

// Filtros e página ficam na URL para sobreviverem à ida ao montador e à volta.
type Search = ReturnType<typeof quoteListSearch>;

export const Route = createFileRoute("/_authenticated/orcamentos/")({
  validateSearch: quoteListSearch,
  head: () => ({
    meta: [
      { title: "Propostas comerciais — Dcalice" },
      { name: "description", content: "Propostas montadas no carrinho, com validade, que viram pedido com um toque." },
      { property: "og:title", content: "Propostas comerciais — Dcalice" },
      { property: "og:description", content: "Propostas montadas no carrinho, com validade, que viram pedido com um toque." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuotesPage,
});

function QuotesPage() {
  const { profile } = useAuth();
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const qc = useQueryClient();
  const convertFn = useServerFn(convertQuoteToOrder);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const q = search.q ?? "";
  const status = search.status ?? "todos";
  const page = Math.max(0, (search.pagina ?? 1) - 1);
  const hasActiveFilters = !!(search.q || search.status);

  const clearFilters = () => navigate({ search: {}, replace: true });
  const setFilters = (patch: Partial<Search>) => navigate({ search: (prev) => ({ ...prev, ...patch, pagina: undefined }), replace: true });
  const setPage = (p: number) => navigate({ search: (prev) => ({ ...prev, pagina: p + 1 > 1 ? p + 1 : undefined }), replace: true });

  const term = q.trim();
  const numberRange = orderNumberSearch(term);
  const like = `%${escapeSearchTerm(term)}%`;

  const list = useQuery({
    queryKey: ["quotes", term, status, page],
    queryFn: async () => {
      let query = supabase
        .from("quotes")
        .select("id, created_at, status, total_amount, valid_until, seller_id, order_id, customers!inner(name)", { count: "exact" })
        .order("created_at", { ascending: false });
      if (status !== "todos") query = query.eq("status", status);
      if (term) {
        // Número digitado busca pelo id do orçamento; texto busca pelo nome do cliente.
        query = numberRange ? query.gte("id", numberRange.gte).lt("id", numberRange.lt) : query.ilike("customers.name_search", like);
      }
      const { data, error, count } = await query.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: data, total: count ?? 0 };
    },
  });

  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE));

  async function convert(id: string) {
    setPendingId(id);
    try {
      const res = await convertFn({ data: { quote_id: id } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.needs_approval ? "Pedido criado e enviado para aprovação do supervisor" : "Pedido criado e aprovado");
      await qc.invalidateQueries({ queryKey: ["quotes"] });
      await qc.invalidateQueries({ queryKey: ["orders"] });
      navigate({ to: "/pedidos/$id", params: { id: res.order_id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível converter o orçamento");
    } finally {
      setPendingId(null);
    }
  }

  async function cancelQuote(id: string) {
    const { error } = await supabase.from("quotes").update({ status: "cancelado" }).eq("id", id);
    if (error) {
      toast.error("Não foi possível cancelar o orçamento");
      return;
    }
    toast.success("Orçamento cancelado");
    await qc.invalidateQueries({ queryKey: ["quotes"] });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Propostas comerciais" description="Propostas montadas no carrinho, com validade, que viram pedido com um toque." />
        {canCreateOrder(profile?.role) && (
          <Button asChild>
            <Link to="/orcamentos/novo">
              <Plus className="h-4 w-4" /> Novo orçamento
            </Link>
          </Button>
        )}
      </div>

      <div className="mb-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_200px] lg:grid-cols-[minmax(0,1fr)_200px_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 pl-9 text-base md:h-9 md:text-sm"
            placeholder="Buscar cliente ou número"
            value={q}
            onChange={(e) => setFilters({ q: e.target.value || undefined })}
          />
        </div>
        <Select value={status} onValueChange={(v) => setFilters({ status: v === "todos" ? undefined : v })}>
          <SelectTrigger className="h-11 text-base md:h-9 md:text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(QUOTE_STATUS_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 md:col-span-full lg:col-span-1 lg:justify-end">
          {list.data && (
            <span className="whitespace-nowrap text-sm text-muted-foreground" aria-live="polite">
              {list.data.total} orçamento{list.data.total === 1 ? "" : "s"}
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
        <ErrorState message="Não foi possível carregar os orçamentos" onRetry={() => list.refetch()} />
      ) : !list.data?.total ? (
        <EmptyState title="Nenhum orçamento com esses filtros">
          {canCreateOrder(profile?.role) && (
            <Link to="/orcamentos/novo" className="font-medium text-primary underline">Criar o primeiro orçamento</Link>
          )}
        </EmptyState>
      ) : (
        <>
          <ul className="divide-y rounded-lg border bg-card">
            {list.data.rows.map((o) => {
              const canAct =
                canCreateOrder(profile?.role) && (o.seller_id === profile?.id || profile?.role === "administrador");
              const expired = isQuoteExpired(o.valid_until);
              return (
                <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{o.customers?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {orderNumber(o.id)} · {new Date(o.created_at).toLocaleDateString("pt-BR")}
                      {o.valid_until
                        ? ` · válido até ${new Date(`${o.valid_until}T00:00:00`).toLocaleDateString("pt-BR")}`
                        : " · sem validade"}
                    </p>
                  </div>
                  {expired && o.status === "aberto" && <Badge variant="outline">Vencido</Badge>}
                  <span className="text-sm font-semibold tabular-nums">{brl(o.total_amount)}</span>
                  <Badge
                    variant={
                      o.status === "cancelado"
                        ? "destructive"
                        : o.status === "convertido"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {QUOTE_STATUS_LABEL[o.status] ?? o.status}
                  </Badge>
                  <div className="flex flex-wrap items-center gap-2">
                    {o.status === "aberto" && canAct && (
                      <>
                        <Button asChild variant="outline" size="sm">
                          <Link to="/orcamentos/novo" search={{ rascunho: o.id }}>
                            <FileText className="h-4 w-4" /> Abrir
                          </Link>
                        </Button>
                        <Button size="sm" onClick={() => convert(o.id)} disabled={pendingId === o.id}>
                          {pendingId === o.id ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Plus className="h-4 w-4" />}
                          Transformar em pedido
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setCancelId(o.id)}>
                          Cancelar
                        </Button>
                      </>
                    )}
                    {o.status === "convertido" && o.order_id && (
                      <Button asChild variant="outline" size="sm">
                        <Link to="/pedidos/$id" params={{ id: o.order_id }}>Ver pedido</Link>
                      </Button>
                    )}
                  </div>
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
                <span className="rounded-md border bg-secondary px-1.5 py-0.5 font-semibold text-foreground">{page + 1}</span>{" "}
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

      <AlertDialog open={!!cancelId} onOpenChange={(open) => !open && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar este orçamento?</AlertDialogTitle>
            <AlertDialogDescription>O orçamento deixa de poder ser convertido em pedido. Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter orçamento</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cancelId) void cancelQuote(cancelId);
                setCancelId(null);
              }}
            >
              Cancelar orçamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
