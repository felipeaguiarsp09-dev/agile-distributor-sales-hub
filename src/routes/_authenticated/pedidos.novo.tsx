import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Minus, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { canCreateOrder, cartTotals, type CartLine } from "@/lib/orders";
import { submitOrder, suggestProducts, validateOrderStock } from "@/lib/orders.functions";
import { PageHeader } from "@/components/ModulePage";
import { CreditBadge, NoAccess, brl } from "@/components/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Search = { cliente?: string | undefined; rascunho?: string | undefined };

export const Route = createFileRoute("/_authenticated/pedidos/novo")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    cliente: typeof s["cliente"] === "string" ? s["cliente"] : undefined,
    rascunho: typeof s["rascunho"] === "string" ? s["rascunho"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Novo pedido — Dcalice" },
      { name: "description", content: "Monte o pedido com o catálogo e sugestões da IA." },
      { property: "og:title", content: "Novo pedido — Dcalice" },
      { property: "og:description", content: "Monte o pedido com o catálogo e sugestões da IA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewOrder,
});

type Suggestion = { id: string | null; product: { id: string; name: string; unit_price: number; stock_quantity: number }; reason: string; score: number };

function NewOrder() {
  const search = Route.useSearch();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const suggestFn = useServerFn(suggestProducts);
  const validateFn = useServerFn(validateOrderStock);
  const submitFn = useServerFn(submitOrder);

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

  const customers = useQuery({
    queryKey: ["customers", "picker"],
    queryFn: async () => (await supabase.from("customers").select("id, name, credit_limit, credit_status").order("name")).data ?? [],
  });
  const products = useQuery({
    queryKey: ["products", "active"],
    queryFn: async () =>
      (await supabase.from("products").select("id, name, sku, category, unit_price, stock_quantity").eq("is_active", true).order("name")).data ?? [],
  });

  // Continua um rascunho existente.
  useEffect(() => {
    if (!search.rascunho) return;
    void (async () => {
      const { data } = await supabase
        .from("orders")
        .select("customer_id, discount_amount, notes, status, order_items(product_id, quantity, was_ai_suggested, products(name, unit_price, stock_quantity))")
        .eq("id", search.rascunho!)
        .maybeSingle();
      if (!data || data.status !== "rascunho") return void setDraftId(null);
      setCustomerId(data.customer_id);
      setDiscount(Number(data.discount_amount));
      setNotes(data.notes ?? "");
      setLines(data.order_items.map((i) => ({ product_id: i.product_id, name: i.products?.name ?? "", unit_price: Number(i.products?.unit_price ?? 0), stock: i.products?.stock_quantity ?? 0, quantity: i.quantity, ai_suggestion_id: i.was_ai_suggested ? "ai" : null })));
    })();
  }, [search.rascunho]);

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
  const setQty = (id: string, qty: number) =>
    setLines((ls) => (qty <= 0 ? ls.filter((l) => l.product_id !== id) : ls.map((l) => (l.product_id === id ? { ...l, quantity: qty } : l))));

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

  async function confirm() {
    if (!profile || !customerId || lines.length === 0) return;
    setSaving(true);
    setProblem(null);
    try {
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
      const { error: itemsErr } = await supabase.from("order_items").insert(
        lines.map((l) => ({ order_id: id!, product_id: l.product_id, quantity: l.quantity, unit_price: l.unit_price, line_total: l.quantity * l.unit_price, was_ai_suggested: !!l.ai_suggestion_id })),
      );
      if (itemsErr) throw new Error("Não foi possível salvar os itens");

      const stock = await validateFn({ data: { order_id: id } });
      if (!stock.ok) {
        setProblem(stock.unavailable_items.map((u) => `${u.name}: pedido ${u.requested}, disponível ${u.available}`));
        toast.error("Estoque insuficiente — ajuste as quantidades. O rascunho foi salvo.");
        return;
      }
      const res = await submitFn({ data: { order_id: id } });
      if (!res.ok) {
        setProblem([res.error]);
        return;
      }
      const accepted = lines.map((l) => l.ai_suggestion_id).filter((x): x is string => !!x && x !== "ai");
      if (accepted.length) await supabase.from("ai_suggestions").update({ was_accepted: true, order_id: id }).in("id", accepted);
      toast.success(res.needs_approval ? "Pedido enviado para aprovação do supervisor" : "Pedido aprovado");
      await qc.invalidateQueries({ queryKey: ["orders"] });
      navigate({ to: "/pedidos/$id", params: { id } });
    } catch (e) {
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

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={draftId ? "Rascunho de pedido" : "Novo pedido"} description="Escolha o cliente, monte o carrinho e confirme." />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="rounded-lg border bg-card p-4">
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
            {customers.data?.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nenhum cliente na sua carteira ainda.</p>}
          </section>

          {customerId && (
            <section className="rounded-lg border border-primary/30 bg-secondary/40 p-4">
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

          <section className="rounded-lg border bg-card p-4">
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
            {products.data?.length === 0 && <p className="text-sm text-muted-foreground">Catálogo vazio.</p>}
            <ul className="max-h-[480px] divide-y overflow-auto">
              {catalog.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.sku} · {p.stock_quantity} em estoque</p>
                  </div>
                  <span className="tabular-nums">{brl(p.unit_price)}</span>
                  <Button size="icon" variant="outline" aria-label={`Adicionar ${p.name}`} disabled={!customerId} onClick={() => add(p)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="h-fit space-y-4 rounded-lg border bg-card p-4 lg:sticky lg:top-6">
          <h2 className="font-semibold">Carrinho</h2>
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">{customerId ? "Adicione produtos do catálogo." : "Selecione um cliente para começar."}</p>
          ) : (
            <ul className="space-y-3">
              {lines.map((l) => (
                <li key={l.product_id} className="text-sm">
                  <div className="flex items-start gap-2">
                    <p className="flex-1 font-medium">{l.name}{l.ai_suggestion_id && <Sparkles className="ml-1 inline h-3 w-3 text-primary" />}</p>
                    <button aria-label="Remover" onClick={() => setQty(l.product_id, 0)}><Trash2 className="h-4 w-4 text-muted-foreground" /></button>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(l.product_id, l.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                    <Input className="h-7 w-16 text-center" type="number" min={1} value={l.quantity} onChange={(e) => setQty(l.product_id, Math.trunc(Number(e.target.value)))} />
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(l.product_id, l.quantity + 1)}><Plus className="h-3 w-3" /></Button>
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
          <Button className="w-full" onClick={confirm} disabled={saving || !customerId || lines.length === 0}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar pedido
          </Button>
        </aside>
      </div>
    </div>
  );
}
