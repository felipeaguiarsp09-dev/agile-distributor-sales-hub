import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Pencil, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CreditBadge, EmptyState, ErrorState, RowsSkeleton, brl } from "@/components/shared";
import { CustomerForm } from "@/components/CustomerForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  head: () => ({
    meta: [
      { title: "Ficha do cliente — Dcalice" },
      { name: "description", content: "Dados cadastrais, crédito e histórico de compras do cliente." },
      { property: "og:title", content: "Ficha do cliente — Dcalice" },
      { property: "og:description", content: "Dados cadastrais, crédito e histórico de compras do cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomerDetail,
});

function CustomerDetail() {
  const { id } = Route.useParams();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "administrador";
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  const customer = useQuery({
    queryKey: ["customers", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const owner = useQuery({
    queryKey: ["profiles", customer.data?.owner_id],
    enabled: !!customer.data,
    queryFn: async () => (await supabase.from("profiles").select("full_name").eq("id", customer.data!.owner_id).maybeSingle()).data,
  });
  const orders = useQuery({
    queryKey: ["orders", "customer", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("id, created_at, status, total_amount, origin").eq("customer_id", id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (customer.isLoading) return <div className="mx-auto max-w-4xl"><RowsSkeleton rows={4} /></div>;
  if (customer.isError) return <ErrorState message="Falha ao carregar a ficha" onRetry={() => customer.refetch()} />;
  const c = customer.data;
  if (!c) return <ErrorState message="Cliente não encontrado" />;
  const addr = (c.address ?? {}) as Record<string, string>;
  const addressLine = [addr["street"], addr["city"], addr["state"], addr["zip"]].filter(Boolean).join(" · ");

  async function remove() {
    if (!confirm("Excluir este cliente? Essa ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) return void toast.error("Não foi possível excluir (o cliente pode ter pedidos)");
    toast.success("Cliente excluído");
    await qc.invalidateQueries({ queryKey: ["customers"] });
    navigate({ to: "/clientes" });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/clientes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>
      <div className="mb-6 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{c.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {c.cnpj_cpf ?? "Sem documento"} {c.external_id && <Badge variant="outline" className="ml-2">ERP {c.external_id}</Badge>}
          </p>
        </div>
        {profile?.role !== "cliente" && (
          <Button asChild variant="secondary">
            <Link to="/pedidos"><ShoppingCart className="h-4 w-4" /> Novo pedido</Link>
          </Button>
        )}
        {isAdmin && !editing && (
          <>
            <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Editar</Button>
            <Button variant="ghost" onClick={remove} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
          </>
        )}
      </div>

      {editing ? (
        <CustomerForm
          submitLabel="Salvar alterações"
          initial={{ name: c.name, cnpj_cpf: c.cnpj_cpf, email: c.email, phone: c.phone, credit_limit: c.credit_limit, credit_status: c.credit_status, owner_id: c.owner_id, address: addr }}
          onSubmit={async (v) => {
            const { error } = await supabase.from("customers").update(v).eq("id", id);
            if (error) return void toast.error("Não foi possível salvar");
            toast.success("Cliente atualizado");
            setEditing(false);
            await qc.invalidateQueries({ queryKey: ["customers"] });
          }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-5 sm:col-span-2">
            <h2 className="mb-3 font-semibold">Dados cadastrais</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Info label="Email" value={c.email} />
              <Info label="Telefone" value={c.phone} />
              <Info label="Endereço" value={addressLine} />
              <Info label="Vendedor responsável" value={owner.data?.full_name} />
            </dl>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <h2 className="mb-3 font-semibold">Crédito</h2>
            <p className="text-2xl font-bold tabular-nums">{brl(c.credit_limit)}</p>
            <p className="mb-3 text-xs text-muted-foreground">Limite de crédito</p>
            <CreditBadge status={c.credit_status} />
          </div>
        </div>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">Histórico de compras</h2>
      {orders.isLoading ? (
        <RowsSkeleton rows={3} />
      ) : orders.isError ? (
        <ErrorState message="Falha ao carregar o histórico" onRetry={() => orders.refetch()} />
      ) : !orders.data?.length ? (
        <EmptyState title="Nenhuma compra registrada ainda" />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {orders.data.map((o) => (
            <li key={o.id} className="flex items-center gap-4 px-4 py-3 text-sm">
              <span className="flex-1">{new Date(o.created_at).toLocaleDateString("pt-BR")}</span>
              <Badge variant="outline">{o.status}</Badge>
              <span className="tabular-nums">{brl(o.total_amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}
