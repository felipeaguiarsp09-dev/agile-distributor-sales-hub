import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Minus, Package, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { createPaymentIntent } from "@/lib/ecommerce.functions";
import { PageHeader } from "@/components/ModulePage";
import { brl, EmptyState, ErrorState, RowsSkeleton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/ecommerce")({
  head: () => ({
    meta: [
      { title: "E-commerce — Dcalice" },
      { name: "description", content: "Vitrine de produtos da Dcalice com carrinho e pagamento online." },
      { property: "og:title", content: "E-commerce — Dcalice" },
      { property: "og:description", content: "Vitrine de produtos da Dcalice com carrinho e pagamento online." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Storefront,
});

type CartItem = { product_id: string; name: string; unit_price: number; stock: number; quantity: number };
const CART_KEY = "dcalice-cart";

function Storefront() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const payFn = useServerFn(createPaymentIntent);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [busy, setBusy] = useState(false);
  const isClient = profile?.role === "cliente";

  useEffect(() => {
    try { setCart(JSON.parse(localStorage.getItem(CART_KEY) ?? "[]")); } catch { /* carrinho vazio */ }
  }, []);
  const save = (c: CartItem[]) => { setCart(c); localStorage.setItem(CART_KEY, JSON.stringify(c)); };

  const products = useQuery({
    queryKey: ["products", "ecommerce"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, description, category, unit_price, stock_quantity, image_url")
        .eq("is_ecommerce_visible", true).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });
  const customer = useQuery({
    queryKey: ["customers", "portal", profile?.id],
    enabled: isClient,
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name, owner_id, organization_id, credit_status").eq("portal_user_id", profile!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const list = useMemo(() => (products.data ?? []).filter((p) => p.name.toLowerCase().includes(search.toLowerCase())), [products.data, search]);
  const total = cart.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  function add(p: NonNullable<typeof products.data>[number]) {
    const cur = cart.find((i) => i.product_id === p.id);
    if ((cur?.quantity ?? 0) + 1 > p.stock_quantity) return void toast.error("Sem estoque suficiente");
    save(cur ? cart.map((i) => (i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i))
      : [...cart, { product_id: p.id, name: p.name, unit_price: Number(p.unit_price), stock: p.stock_quantity, quantity: 1 }]);
  }
  const setQty = (id: string, q: number) => save(cart.flatMap((i) => (i.product_id !== id ? [i] : q <= 0 ? [] : [{ ...i, quantity: Math.min(q, i.stock) }])));

  async function checkout() {
    const c = customer.data;
    if (!c || !cart.length) return;
    setBusy(true);
    try {
      const { data: order, error } = await supabase.from("orders")
        .insert({ organization_id: c.organization_id, customer_id: c.id, seller_id: c.owner_id, origin: "ecommerce" })
        .select("id").single();
      if (error) throw error;
      const { error: itemErr } = await supabase.from("order_items").insert(
        cart.map((i) => ({ order_id: order.id, product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price, line_total: i.quantity * i.unit_price })),
      );
      if (itemErr) throw itemErr;
      const { error: subErr } = await supabase.rpc("submit_order", { p_order_id: order.id });
      if (subErr) throw new Error(subErr.message.includes("Estoque") ? "Um dos produtos ficou sem estoque. Ajuste o carrinho." : subErr.message);
      save([]);
      void qc.invalidateQueries({ queryKey: ["orders"] });
      const pay = await payFn({ data: { order_id: order.id } });
      if (pay.checkout_url) { window.location.href = pay.checkout_url; return; }
      toast[pay.status === "erro" ? "error" : "success"](pay.message);
      void navigate({ to: "/ecommerce/pedidos" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir a compra");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex-1"><PageHeader title="E-commerce" description="Escolha os produtos, confira o carrinho e pague online." /></div>
        {isClient && <Button variant="outline" asChild><Link to="/ecommerce/pedidos">Meus pedidos</Link></Button>}
      </div>
      {!isClient && <p className="mb-4 rounded-md border bg-muted p-3 text-sm text-muted-foreground">Você está vendo a vitrine como a equipe. A compra é feita pelo cliente com o login dele.</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <Input placeholder="Buscar produto" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4" />
          {products.isLoading ? <RowsSkeleton rows={4} /> : products.isError ? (
            <ErrorState message="Não foi possível carregar a vitrine" onRetry={() => products.refetch()} />
          ) : !list.length ? (
            <EmptyState title="Nenhum produto na vitrine">{search ? "Tente outra busca." : "Os produtos marcados para o e-commerce aparecem aqui."}</EmptyState>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((p) => (
                <div key={p.id} className="flex flex-col rounded-lg border bg-card p-3">
                  <div className="mb-2 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md bg-muted">
                    {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" /> : <Package className="h-8 w-8 text-muted-foreground" />}
                  </div>
                  <p className="font-medium">{p.name}</p>
                  {p.category && <p className="text-xs text-muted-foreground">{p.category}</p>}
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <span className="font-semibold tabular-nums">{brl(Number(p.unit_price))}</span>
                    <Button size="sm" disabled={!isClient || p.stock_quantity <= 0} onClick={() => add(p)}>
                      {p.stock_quantity <= 0 ? "Esgotado" : <><Plus className="h-4 w-4" /> Adicionar</>}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="h-fit rounded-lg border bg-card p-4 lg:sticky lg:top-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><ShoppingBag className="h-4 w-4" /> Carrinho</h2>
          {!cart.length ? <p className="text-sm text-muted-foreground">Seu carrinho está vazio.</p> : (
            <ul className="space-y-3">
              {cart.map((i) => (
                <li key={i.product_id} className="text-sm">
                  <p className="font-medium">{i.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty(i.product_id, i.quantity - 1)} aria-label="Diminuir"><Minus className="h-3 w-3" /></Button>
                    <span className="w-6 text-center tabular-nums">{i.quantity}</span>
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setQty(i.product_id, i.quantity + 1)} aria-label="Aumentar"><Plus className="h-3 w-3" /></Button>
                    <span className="ml-auto tabular-nums">{brl(i.quantity * i.unit_price)}</span>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setQty(i.product_id, 0)} aria-label="Remover"><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex justify-between border-t pt-3 font-semibold"><span>Total</span><span className="tabular-nums">{brl(total)}</span></div>
          {isClient && customer.isSuccess && !customer.data && <p className="mt-2 text-sm text-destructive">Seu login ainda não está ligado a um cadastro de cliente. Fale com a distribuidora.</p>}
          <Button className="mt-3 w-full" disabled={!isClient || !cart.length || busy || !customer.data} onClick={checkout}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Finalizar e pagar
          </Button>
        </aside>
      </div>
    </div>
  );
}
