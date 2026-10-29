import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, History, Loader2, Package, RefreshCw, Search, ShoppingBag, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { canCreateOrder, cartTotals, changeCartQuantity, lastPurchase, purchasedProducts, type CartLine, type HistoryOrder } from "@/lib/orders";
import { submitOrder, suggestProducts, validateOrderStock } from "@/lib/orders.functions";
import { PageHeader } from "@/components/ModulePage";
import { CreditBadge, ErrorState, NoAccess, RowsSkeleton, brl } from "@/components/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuantityControl } from "@/components/QuantityControl";
import { Textarea } from "@/components/ui/textarea";

type Search = { cliente?: string | undefined; rascunho?: string | undefined; repetir?: string | undefined };

export const Route = createFileRoute("/_authenticated/pedidos/novo")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    cliente: typeof s["cliente"] === "string" ? s["cliente"] : undefined,
    rascunho: typeof s["rascunho"] === "string" ? s["rascunho"] : undefined,
    repetir: typeof s["repetir"] === "string" ? s["repetir"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Novo pedido — Dcalice" },
      { name: "description", content: "Monte o pedido com o catálogo, o histórico de compras e sugestões da IA." },
      { property: "og:title", content: "Novo pedido — Dcalice" },
      { property: "og:description", content: "Monte o pedido com o catálogo, o histórico de compras e sugestões da IA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewOrder,
});

type Suggestion = { id: string | null; product: { id: string; name: string; unit_price: number; stock_quantity: number }; reason: string; score: number };
type RepeatOrder = {
  id: string;
  customer_id: string;
  status: string;
  discount_amount: number;
  order_items: Array<{ product_id: string; quantity: number; unit_price: number; was_ai_suggested: boolean; products: { name: string; unit_price: number; stock_quantity: number } | null }>;
};

function itemsToCartLines(items: RepeatOrder["order_items"]): CartLine[] {
  return items.map((i) => ({
    product_id: i.product_id,
    name: i.products?.name ?? "",
    unit_price: Number(i.products?.unit_price ?? i.unit_price),
    stock: i.products?.stock_quantity ?? 0,
    quantity: i.quantity,
    ai_suggestion_id: i.was_ai_suggested ? "ai" : null,
  }));
}

function NewOrder() {
  const search = Route.useSearch();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const suggestFn = useServerFn(suggestProducts);
  const validateFn = useServerFn(validateOrderStock);
  const submitFn = useServerFn(submitOrder);

  const cartRef = useRef<HTMLElement>(null);
  const [customerId, setCustomerId] = useState(search.cliente ?? "");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [draftId, setDraftId] = useState<string | null>(search.rascunho ?? null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("todas");
  const [problem, setProblem] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [sugState, setSugState] = useState<"idle" | "loading" | "error">("idle");

  // Rascunho automático
  const [ready, setReady] = useState(!search.rascunho && !search.repetir);
  const [draftState, setDraftState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [saveTick, setSaveTick] = useState(0);
  const [repeatConfirm, setRepeatConfirm] = useState(false);
  const lastSnapshotRef = useRef<string | null>(null);
  const savingDraftRef = useRef(false);
  const resaveRef = useRef(false);
  const submittedRef = useRef(false);

  const customers = useQuery({
    queryKey: ["customers", "picker"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name, credit_limit, credit_status").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const products = useQuery({
    queryKey: ["products", "active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, sku, category, unit_price, stock_quantity, image_url").eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const history = useQuery({
    queryKey: ["orders", "customer-history", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, created_at, status, discount_amount, order_items(product_id, quantity, unit_price, was_ai_suggested, products(name, unit_price, stock_quantity))")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as HistoryOrder[];
    },
  });

  // Continua um rascunho existente.
  useEffect(() => {
    const existingDraft = search.rascunho;
    if (!existingDraft) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("orders")
        .select("customer_id, discount_amount, notes, status, order_items(product_id, quantity, unit_price, was_ai_suggested, products(name, unit_price, stock_quantity))")
        .eq("id", existingDraft)
        .maybeSingle();
      if (cancelled) return;
      if (!data || data.status !== "rascunho") {
        setDraftId(null);
        setReady(true);
        return;
      }
      const mapped = itemsToCartLines(data.order_items);
      setCustomerId(data.customer_id);
      setDiscount(Number(data.discount_amount));
      setNotes(data.notes ?? "");
      setLines(mapped);
      lastSnapshotRef.current = JSON.stringify([data.customer_id, mapped, Number(data.discount_amount), data.notes ?? ""]);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [search.rascunho]);

  // Repete um pedido aprovado/faturado: carrega os itens no carrinho.
  useEffect(() => {
    const repeatId = search.repetir;
    if (!repeatId) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, customer_id, status, discount_amount, order_items(product_id, quantity, unit_price, was_ai_suggested, products(name, unit_price, stock_quantity))")
        .eq("id", repeatId)
        .maybeSingle();
      if (cancelled) return;
      if (!data || !["aprovado", "faturado"].includes(data.status)) {
        toast.error("Este pedido não pode ser repetido");
      } else {
        const mapped = itemsToCartLines(data.order_items);
        setCustomerId(data.customer_id);
        setDiscount(Number(data.discount_amount));
        setLines(mapped);
        lastSnapshotRef.current = JSON.stringify([data.customer_id, mapped, Number(data.discount_amount), ""]);
        toast.success("Último pedido carregado no carrinho");
      }
      setReady(true);
      void navigate({ to: "/pedidos/novo", search: (prev: Search) => ({ ...prev, repetir: undefined }), replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [search.repetir]);

  // Rascunho automático: salva sozinho 1,5s depois de qualquer mudança.
  useEffect(() => {
    if (!ready || !profile || saving || submittedRef.current) return;
    if (!customerId) {
      lastSnapshotRef.current = null;
      return;
    }
    const snap = JSON.stringify([customerId, lines, discount, notes]);
    if (snap === lastSnapshotRef.current) return;
    if (lines.length === 0 && !draftId) {
      lastSnapshotRef.current = snap;
      return;
    }
    const timer = setTimeout(() => {
      if (savingDraftRef.current) {
        resaveRef.current = true;
        return;
      }
      savingDraftRef.current = true;
      const savedSnap = snap;
      void (async () => {
        try {
          setDraftState("saving");
          const totals = cartTotals(lines, discount);
          const fields = { customer_id: customerId, discount_amount: totals.discount, notes: notes || null };
          let id = draftId;
          if (!id) {
            const { data, error } = await supabase
              .from("orders")
              .insert({ ...fields, organization_id: profile.organization_id, seller_id: profile.id, origin: "vendedor" })
              .select("id")
              .single();
            if (error) throw new Error("Falha ao salvar o rascunho");
            id = data.id;
            setDraftId(id);
          } else {
            const { error } = await supabase.from("orders").update(fields).eq("id", id);
            if (error) throw new Error("Falha ao salvar o rascunho");
            const removed = await supabase.from("order_items").delete().eq("order_id", id);
            if (removed.error) throw new Error("Falha ao salvar o rascunho");
          }
          if (submittedRef.current) {
            setDraftState("idle");
            return;
          }
          const inserted = await supabase.from("order_items").insert(
            lines.map((l) => ({ order_id: id!, product_id: l.product_id, quantity: l.quantity, unit_price: l.unit_price, line_total: l.quantity * l.unit_price, was_ai_suggested: !!l.ai_suggestion_id })),
          );
          if (inserted.error) throw new Error("Falha ao salvar o rascunho");
          lastSnapshotRef.current = savedSnap;
          setDraftState("saved");
          setDraftSavedAt(new Date());
        } catch {
          if (!submittedRef.current) setDraftState("error");
        } finally {
          savingDraftRef.current = false;
          if (resaveRef.current) {
            resaveRef.current = false;
            setSaveTick((t) => t + 1);
          }
        }
      })();
    }, 1500);
    return () => clearTimeout(timer);
  }, [ready, profile, customerId, lines, discount, notes, draftId, saving, retryTick, saveTick]);

  if (!canCreateOrder(profile?.role)) return <NoAccess />;
  const customer = customers.data?.find((c) => c.id === customerId);
  const totals = cartTotals(lines, discount);

  function add(p: { id: string; name: string; unit_price: number; stock_quantity: number }, aiId: string | null = null) {
    setProblem(null);
    setLines((ls) => {
      const found = ls.find((l) => l.product_id === p.id);
      if (found) return ls.map((l) => (l.product_id === p.id ? { ...l, quantity: l.quantity + 1, ai_suggestion_id: l.ai_suggestion_id ?? aiId } : l));
      return [...ls, { product_id: p.id, name: p.name, unit_price: Number(p.unit_price), stock: p.stock_quantity, quantity: 1, ai_suggestion_id: aiId }];
    });
  }
  const adjust = (id: string, delta: number) => {
    setProblem(null);
    setLines((ls) => changeCartQuantity(ls, id, delta));
  };
  const setQty = (id: string, qty: number) => {
    if (!Number.isFinite(qty) || qty < 0) return;
    setProblem(null);
    setLines((ls) => (qty === 0 ? ls.filter((l) => l.product_id !== id) : ls.map((l) => (l.product_id === id ? { ...l, quantity: Math.trunc(qty) } : l))));
  };

  const repeat = history.data ? lastPurchase(history.data) : null;
  const topPurchased = history.data ? purchasedProducts(history.data) : [];

  function applyRepeat(repeatLines: CartLine[], discountAmount: number) {
    setProblem(null);
    setLines(repeatLines);
    setDiscount(discountAmount);
    setRepeatConfirm(false);
  }

  async function loadSuggestions() {
    if (!customerId) return;
    setSugState("loading");
    try {
      const res = await suggestFn({ data: { customer_id: customerId, current_item_ids: lines.map((l) => l.product_id) } });
      setSugs(res.suggestions as Suggestion[]);
      setSugState("idle");
    } catch {
      setSugState("error");
    }
  }

  /** Espera qualquer salvamento automático em andamento terminar. */
  function waitDraftIdle() {
    return new Promise<void>((resolve) => {
      const start = Date.now();
      const check = () => (!savingDraftRef.current || Date.now() - start > 2500 ? resolve() : setTimeout(check, 50));
      check();
    });
  }

  async function confirm() {
    if (!profile || !customerId || lines.length === 0) return;
    setSaving(true);
    setProblem(null);
    try {
      await waitDraftIdle();
      let id = draftId;
      const fields = { customer_id: customerId, discount_amount: totals.discount, notes: notes || null };
      if (!id) {
        const { data, error } = await supabase
          .from("orders")
          .insert({ ...fields, organization_id: profile.organization_id, seller_id: profile.id, origin: "vendedor" })
          .select("id")
          .single();
        if (error) throw new Error("Não foi possível salvar o pedido");
        id = data.id;
        setDraftId(id);
      } else {
        const { error } = await supabase.from("orders").update(fields).eq("id", id);
        if (error) throw new Error("Não foi possível atualizar o rascunho");
        await supabase.from("order_items").delete().eq("order_id", id);
      }
      if (!id) throw new Error("Não foi possível salvar o pedido");
      const orderId = id;
      const { error: itemsErr } = await supabase.from("order_items").insert(
        lines.map((l) => ({ order_id: orderId, product_id: l.product_id, quantity: l.quantity, unit_price: l.unit_price, line_total: l.quantity * l.unit_price, was_ai_suggested: !!l.ai_suggestion_id })),
      );
      if (itemsErr) throw new Error("Não foi possível salvar os itens");

      const stock = await validateFn({ data: { order_id: id } });
      if (!stock.ok) {
        setProblem(stock.unavailable_items.map((u) => `${u.name}: pedido ${u.requested}, disponível ${u.available}`));
        toast.error("Estoque insuficiente — ajuste as quantidades. O rascunho foi salvo.");
        return;
      }
      submittedRef.current = true;
      const res = await submitFn({ data: { order_id: id } });
      if (!res.ok) {
        submittedRef.current = false;
        setProblem([res.error]);
        return;
      }
      const accepted = lines.map((l) => l.ai_suggestion_id).filter((x): x is string => !!x && x !== "ai");
      if (accepted.length) await supabase.from("ai_suggestions").update({ was_accepted: true, order_id: id }).in("id", accepted);
      toast.success(res.needs_approval ? "Pedido enviado para aprovação do supervisor" : "Pedido aprovado");
      await qc.invalidateQueries({ queryKey: ["orders"] });
      navigate({ to: "/pedidos/$id", params: { id } });
    } catch (e) {
      submittedRef.current = false;
      toast.error(e instanceof Error ? e.message : "Falha ao confirmar o pedido");
    } finally {
      setSaving(false);
    }
  }

  const categories = [...new Set((products.data ?? []).map((p) => p.category).filter(Boolean))] as string[];
  const term = q.trim().toLowerCase();
  const catalog = (products.data ?? []).filter(
    (p) => (cat === "todas" || p.category === cat) && (!term || p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)),
  );
  const overLimit = customer && totals.total > Number(customer.credit_limit) && Number(customer.credit_limit) > 0;
  const draftLabel =
    draftState === "saving"
      ? "Salvando rascunho..."
      : draftState === "saved" && draftSavedAt
        ? `Rascunho salvo às ${draftSavedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
        : null;

  return (
    <div className="mx-auto max-w-6xl pb-24 lg:pb-0">
      <PageHeader title={draftId ? "Rascunho de pedido" : "Novo pedido"} description="Escolha o cliente, monte o carrinho e confirme." />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="border-b pb-5">
            <Label>Cliente</Label>
            <Select value={customerId} onValueChange={(v) => { setCustomerId(v); setSugs([]); setSugState("idle"); }}>
              <SelectTrigger className="mt-2"><SelectValue placeholder="Selecione um cliente da carteira" /></SelectTrigger>
              <SelectContent>
                {(customers.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {customer && (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <CreditBadge status={customer.credit_status} />
                <span className="text-muted-foreground">Limite de crédito {brl(customer.credit_limit)}</span>
              </div>
            )}
            {customers.isLoading && <p className="mt-2 text-sm text-muted-foreground">Carregando clientes...</p>}
            {customers.isError && (
              <p className="mt-2 text-sm text-destructive">
                Não foi possível carregar os clientes.{" "}
                <button className="underline" onClick={() => customers.refetch()}>Tentar novamente</button>
              </p>
            )}
            {customers.data?.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nenhum cliente na sua carteira ainda.</p>}
          </section>

          {customerId && (
            <section className="border-b pb-5">
              <div className="flex flex-wrap items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <h2 className="flex-1 font-semibold">Comprados antes</h2>
                {repeat && (
                  <Button size="sm" variant="outline" onClick={() => (lines.length === 0 ? applyRepeat(repeat.lines, repeat.discountAmount) : setRepeatConfirm(true))}>
                    <RefreshCw className="h-4 w-4" /> Repetir último pedido
                  </Button>
                )}
              </div>
              {history.isLoading && <p className="mt-3 text-sm text-muted-foreground">Carregando histórico de compras...</p>}
              {history.isError && (
                <p className="mt-3 text-sm text-destructive">
                  Não foi possível carregar o histórico de compras.{" "}
                  <button className="underline" onClick={() => history.refetch()}>Tentar novamente</button>
                </p>
              )}
              {!history.isLoading && !history.isError && topPurchased.length === 0 && (
                <p className="mt-3 text-sm text-muted-foreground">Este cliente ainda não tem pedidos aprovados.</p>
              )}
              {topPurchased.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {topPurchased.map((p) => {
                    const cartQty = lines.find((l) => l.product_id === p.product_id)?.quantity ?? 0;
                    return (
                      <li key={p.product_id} className="flex items-center gap-3 rounded-md bg-card p-3 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-medium">{p.name}</p>
                          <p className="text-muted-foreground">{brl(p.unit_price)} · {p.ordersCount > 1 ? `${p.ordersCount} pedidos` : "1 pedido"}</p>
                        </div>
                        <QuantityControl
                          name={p.name}
                          quantity={cartQty}
                          disabled={saving}
                          onIncrease={() => add({ id: p.product_id, name: p.name, unit_price: p.unit_price, stock_quantity: p.stock_quantity })}
                          onDecrease={() => adjust(p.product_id, -1)}
                          onQuantityChange={(qty) => setQty(p.product_id, qty)}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
              <AlertDialog open={repeatConfirm} onOpenChange={setRepeatConfirm}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Substituir o carrinho pelo último pedido?</AlertDialogTitle>
                    <AlertDialogDescription>Os itens atuais serão removidos e substituídos pelos do último pedido aprovado deste cliente.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Continuar editando</AlertDialogCancel>
                    <AlertDialogAction onClick={() => repeat && applyRepeat(repeat.lines, repeat.discountAmount)}>Substituir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </section>
          )}

          {customerId && (
            <section className="border-b pb-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="flex-1 font-semibold">Sugestões da IA</h2>
                <Button size="sm" variant="outline" onClick={loadSuggestions} disabled={sugState === "loading"}>
                  {sugState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {sugs.length ? "Atualizar" : "Gerar sugestões"}
                </Button>
              </div>
              {sugState === "loading" && <p className="mt-3 text-sm text-muted-foreground">Analisando histórico do cliente...</p>}
              {sugState === "error" && <p className="mt-3 text-sm text-destructive">Não foi possível gerar sugestões agora. O pedido continua normalmente.</p>}
              {sugState === "idle" && sugs.length === 0 && <p className="mt-3 text-sm text-muted-foreground">A IA sugere itens com base no histórico; você decide o que entra no pedido.</p>}
              <ul className="mt-3 space-y-2">
                {sugs.map((s) => (
                  <li key={s.product.id} className="flex items-start gap-3 rounded-md bg-card p-3 text-sm">
                    <div className="flex-1">
                      <p className="font-medium">{s.product.name} · {brl(s.product.unit_price)}</p>
                      <p className="text-muted-foreground">{s.reason}</p>
                    </div>
                    <Button size="sm" onClick={() => { add(s.product, s.id); setSugs((x) => x.filter((y) => y !== s)); }}>Adicionar</Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="border-b pb-5">
            <h2 className="mb-3 font-semibold">Catálogo</h2>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar por nome ou SKU" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <Select value={cat} onValueChange={setCat}>
                <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as categorias</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {products.isLoading && <RowsSkeleton rows={3} />}
            {products.isError && <ErrorState message="Não foi possível carregar o catálogo" onRetry={() => products.refetch()} />}
            {products.data?.length === 0 && <p className="text-sm text-muted-foreground">Catálogo vazio.</p>}
            {!!products.data?.length && catalog.length === 0 && <p className="text-sm text-muted-foreground">Nenhum produto com esses filtros.</p>}
            <ul className="divide-y">
              {catalog.map((p) => {
                const quantity = lines.find((l) => l.product_id === p.id)?.quantity ?? 0;
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 py-4 text-sm sm:flex-nowrap">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                      {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-contain" loading="lazy" /> : <Package className="h-6 w-6 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-semibold">{p.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{p.sku} · {p.stock_quantity} em estoque</p>
                      <p className="mt-1 font-semibold tabular-nums">{brl(p.unit_price)}</p>
                    </div>
                    <QuantityControl name={p.name} quantity={quantity} disabled={!customerId || saving} onIncrease={() => add(p)} onDecrease={() => adjust(p.id, -1)} onQuantityChange={(qty) => setQty(p.id, qty)} />
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <aside ref={cartRef} id="order-cart" className="scroll-mt-4 h-fit space-y-4 rounded-lg border bg-card p-4 lg:sticky lg:top-6">
          <h2 className="flex items-center gap-2 font-semibold"><ShoppingBag className="h-4 w-4" /> Carrinho <span className="ml-auto text-sm text-muted-foreground">{lines.reduce((sum, l) => sum + l.quantity, 0)} itens</span></h2>
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">{customerId ? "Adicione produtos do catálogo." : "Selecione um cliente para começar."}</p>
          ) : (
            <ul className="space-y-3">
              {lines.map((l) => (
                <li key={l.product_id} className="text-sm">
                  <div className="flex items-start gap-2">
                    <p className="flex-1 font-medium">{l.name}{l.ai_suggestion_id && <Sparkles className="ml-1 inline h-3 w-3 text-primary" />}</p>
                    <Button size="icon" variant="ghost" aria-label={`Remover ${l.name}`} title={`Remover ${l.name}`} onClick={() => setQty(l.product_id, 0)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <QuantityControl name={l.name} quantity={l.quantity} disabled={saving} onIncrease={() => adjust(l.product_id, 1)} onDecrease={() => adjust(l.product_id, -1)}>
                      <Input aria-label={`Quantidade de ${l.name}`} className="h-10 w-10 shrink-0 px-0 text-center" type="number" min={1} value={l.quantity} disabled={saving} onChange={(e) => { if (e.target.value !== "") setQty(l.product_id, Number(e.target.value)); }} />
                    </QuantityControl>
                    <span className="ml-auto tabular-nums">{brl(l.quantity * l.unit_price)}</span>
                  </div>
                  {l.quantity > l.stock && <p className="mt-1 text-xs text-destructive">Só {l.stock} em estoque</p>}
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-2 border-t pt-3 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{brl(totals.subtotal)}</span></div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="disc">Desconto (R$)</Label>
              <Input id="disc" className="h-8 w-28 text-right" type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
            </div>
            <div className="flex justify-between text-base font-bold"><span>Total</span><span className="tabular-nums">{brl(totals.total)}</span></div>
          </div>
          <Textarea placeholder="Observações do pedido" value={notes} onChange={(e) => setNotes(e.target.value)} />
          {customer && customer.credit_status !== "ok" && (
            <Alert><AlertTriangle className="h-4 w-4" /><AlertTitle>Crédito {customer.credit_status}</AlertTitle><AlertDescription>O pedido irá para aprovação do supervisor.</AlertDescription></Alert>
          )}
          {overLimit && (
            <Alert><AlertTriangle className="h-4 w-4" /><AlertTitle>Acima do limite de crédito</AlertTitle><AlertDescription>O total passa do limite de {brl(customer.credit_limit)}.</AlertDescription></Alert>
          )}
          {problem && (
            <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Não foi possível confirmar</AlertTitle>
              <AlertDescription><ul>{problem.map((p) => <li key={p}>{p}</li>)}</ul></AlertDescription></Alert>
          )}
          {draftLabel && <p className="text-xs text-muted-foreground">{draftLabel}</p>}
          {draftState === "error" && (
            <p className="text-xs text-destructive">
              Falha ao salvar o rascunho.{" "}
              <button className="underline" onClick={() => { lastSnapshotRef.current = null; setRetryTick((t) => t + 1); setDraftState("idle"); }}>Tentar novamente</button>
            </p>
          )}
          <Button className="w-full" onClick={confirm} disabled={saving || !customerId || lines.length === 0}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar pedido
          </Button>
        </aside>
      </div>
      {lines.length > 0 && <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background p-3 lg:hidden">
        <Button className="h-12 w-full justify-between" onClick={() => cartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
          <span className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> Ver carrinho · {lines.reduce((sum, l) => sum + l.quantity, 0)} itens</span>
          <span className="tabular-nums">{brl(totals.total)}</span>
        </Button>
      </div>}
    </div>
  );
}
