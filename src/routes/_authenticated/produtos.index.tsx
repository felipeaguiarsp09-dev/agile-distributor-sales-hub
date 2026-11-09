import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Package, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/ModulePage";
import { EmptyState, ErrorState, RowsSkeleton, brl } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/produtos/")({
  head: () => ({
    meta: [
      { title: "Produtos — Dcalice" },
      { name: "description", content: "Catálogo com preço, categoria e estoque espelhado do ERP." },
      { property: "og:title", content: "Produtos — Dcalice" },
      { property: "og:description", content: "Catálogo com preço, categoria e estoque espelhado do ERP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "administrador";
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("todas");
  const [vis, setVis] = useState("todos");

  const list = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, sku, name, category, unit_price, stock_quantity, is_ecommerce_visible, is_active, image_url")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const categories = [...new Set((list.data ?? []).map((p) => p.category).filter(Boolean))] as string[];
  const term = q.trim().toLowerCase();
  const rows = (list.data ?? []).filter(
    (p) =>
      (cat === "todas" || p.category === cat) &&
      (vis === "todos" || (vis === "sim") === p.is_ecommerce_visible) &&
      (!term || p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)),
  );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Produtos" description="Catálogo com preço e estoque espelhado do ERP." />
        {isAdmin && (
          <Button disabled title="Os produtos são cadastrados no ERP">
            <Plus className="h-4 w-4" /> Novo produto
          </Button>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
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
        <Select value={vis} onValueChange={setVis}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">E-commerce: todos</SelectItem>
            <SelectItem value="sim">Visíveis no E-commerce</SelectItem>
            <SelectItem value="nao">Fora do E-commerce</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {list.isLoading ? (
        <RowsSkeleton />
      ) : list.isError ? (
        <ErrorState message="Não foi possível carregar os produtos" onRetry={() => list.refetch()} />
      ) : !list.data?.length ? (
        <EmptyState title="Catálogo vazio — importe seus produtos">
          {isAdmin && <Link to="/admin/importacao" className="font-medium text-primary underline">Ir para Importação</Link>}
        </EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState title="Nenhum produto encontrado com esses filtros" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <Link key={p.id} to="/produtos/$id" params={{ id: p.id }} className="flex gap-3 rounded-lg border bg-card p-3 hover:border-primary/40">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary">
                {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : <Package className="h-6 w-6 text-primary" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.sku}{p.category ? ` · ${p.category}` : ""}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold tabular-nums">{brl(p.unit_price)}</span>
                  <span className={p.stock_quantity > 0 ? "text-muted-foreground" : "text-destructive"}>{p.stock_quantity} em estoque</span>
                </div>
                <div className="mt-1 flex gap-1">
                  {p.is_ecommerce_visible && <Badge variant="secondary">Visível no E-commerce</Badge>}
                  {!p.is_active && <Badge variant="outline">Inativo</Badge>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
