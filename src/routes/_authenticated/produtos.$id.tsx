import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Package, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState, ErrorState, RowsSkeleton, brl } from "@/components/shared";
import { ProductForm } from "@/components/ProductForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/produtos/$id")({
  head: () => ({
    meta: [
      { title: "Produto — Dcalice" },
      { name: "description", content: "Preço, estoque, visibilidade no E-commerce e previsão de demanda." },
      { property: "og:title", content: "Produto — Dcalice" },
      { property: "og:description", content: "Preço, estoque, visibilidade no E-commerce e previsão de demanda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductDetail,
});

function ProductDetail() {
  const { id } = Route.useParams();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "administrador";
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const product = useQuery({
    queryKey: ["products", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const forecast = useQuery({
    queryKey: ["demand_forecasts", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("demand_forecasts").select("*").eq("product_id", id).order("generated_at", { ascending: false }).limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  if (product.isLoading) return <div className="mx-auto max-w-4xl"><RowsSkeleton rows={4} /></div>;
  if (product.isError) return <ErrorState message="Falha ao carregar o produto" onRetry={() => product.refetch()} />;
  const p = product.data;
  if (!p) return <ErrorState message="Produto não encontrado" />;

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/produtos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Produtos
      </Link>
      {editing ? (
        <ProductForm
          submitLabel="Salvar alterações"
          initial={{ sku: p.sku, name: p.name, description: p.description, category: p.category, unit_price: p.unit_price, stock_quantity: p.stock_quantity, is_ecommerce_visible: p.is_ecommerce_visible, is_active: p.is_active, image_url: p.image_url }}
          onSubmit={async (v) => {
            const { error } = await supabase.from("products").update(v).eq("id", id);
            if (error) return void toast.error("Não foi possível salvar as alterações");
            toast.success("Produto atualizado");
            setEditing(false);
            await qc.invalidateQueries({ queryKey: ["products"] });
          }}
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-[240px_1fr]">
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border bg-secondary">
            {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : <Package className="h-10 w-10 text-primary" />}
          </div>
          <div>
            <div className="flex flex-wrap items-start gap-3">
              <h1 className="flex-1 text-2xl font-bold sm:text-3xl">{p.name}</h1>
              {isAdmin && <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Editar</Button>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">SKU {p.sku}{p.category ? ` · ${p.category}` : ""}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {p.is_ecommerce_visible ? <Badge variant="secondary">Visível no E-commerce</Badge> : <Badge variant="outline">Fora do E-commerce</Badge>}
              {!p.is_active && <Badge variant="destructive">Inativo</Badge>}
            </div>
            <div className="mt-4 flex gap-8">
              <div><p className="text-2xl font-bold tabular-nums">{brl(p.unit_price)}</p><p className="text-xs text-muted-foreground">Preço unitário</p></div>
              <div><p className="text-2xl font-bold tabular-nums">{p.stock_quantity}</p><p className="text-xs text-muted-foreground">Em estoque</p></div>
            </div>
            {p.description && <p className="mt-4 text-sm">{p.description}</p>}
          </div>
        </div>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">Previsão de demanda</h2>
      {forecast.isLoading ? (
        <RowsSkeleton rows={1} />
      ) : forecast.isError ? (
        <ErrorState message="Não foi possível carregar a previsão" onRetry={() => forecast.refetch()} />
      ) : !forecast.data ? (
        <EmptyState title="Sem previsão de demanda gerada ainda" />
      ) : (
        <div className="rounded-lg border bg-card p-5 text-sm">
          <p className="text-xl font-bold">{forecast.data.forecast_quantity} unidades</p>
          <p className="text-muted-foreground">
            {new Date(forecast.data.period_start).toLocaleDateString("pt-BR")} a {new Date(forecast.data.period_end).toLocaleDateString("pt-BR")}
          </p>
          {forecast.data.rationale && <p className="mt-2">{forecast.data.rationale}</p>}
        </div>
      )}
    </div>
  );
}
