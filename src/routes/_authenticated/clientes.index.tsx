import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/ModulePage";
import { ActiveBadge, CreditBadge, EmptyState, ErrorState, RowsSkeleton, brl } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/clientes/")({
  head: () => ({
    meta: [
      { title: "Clientes — Dcalice" },
      { name: "description", content: "Carteira de clientes com busca e situação de crédito." },
      { property: "og:title", content: "Clientes — Dcalice" },
      { property: "og:description", content: "Carteira de clientes com busca e situação de crédito." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "administrador";
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("todos");

  const list = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, cnpj_cpf, phone, credit_limit, credit_status, is_active, external_id")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const term = q.trim().toLowerCase();
  const digits = term.replace(/\D/g, "");
  const rows = (list.data ?? []).filter(
    (c) =>
      (status === "todos" || (status === "ativo" ? c.is_active : status === "inativo" ? !c.is_active : status === "ok" ? c.credit_status === "ok" : c.credit_status !== "ok")) &&
      (!term || c.name.toLowerCase().includes(term) || (digits && (c.cnpj_cpf ?? "").replace(/\D/g, "").includes(digits))),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Clientes"
          description={isAdmin ? "Todos os clientes da distribuidora." : profile?.role === "supervisor" ? "Clientes da sua equipe." : "Sua carteira de clientes."}
        />
        {isAdmin && (
          <Button asChild>
            <Link to="/clientes/novo"><Plus className="h-4 w-4" /> Novo cliente</Link>
          </Button>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome ou CNPJ/CPF" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as situações</SelectItem>
            <SelectItem value="ok">Crédito OK</SelectItem>
            <SelectItem value="restrito">Restrito</SelectItem>
            <SelectItem value="bloqueado">Bloqueado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {list.isLoading ? (
        <RowsSkeleton />
      ) : list.isError ? (
        <ErrorState message="Não foi possível carregar os clientes" onRetry={() => list.refetch()} />
      ) : !list.data?.length ? (
        isAdmin ? (
          <EmptyState title="Importe sua base de clientes">
            <Link to="/admin/importacao" className="font-medium text-primary underline">Ir para Importação</Link>
          </EmptyState>
        ) : (
          <EmptyState title="Nenhum cliente na sua carteira ainda" />
        )
      ) : rows.length === 0 ? (
        <EmptyState title="Nenhum cliente encontrado com esses filtros" />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {rows.map((c) => (
            <li key={c.id}>
              <Link to="/clientes/$id" params={{ id: c.id }} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/50">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.cnpj_cpf ?? "Sem documento"} · {c.phone ?? "Sem telefone"}
                  </p>
                </div>
                {c.external_id && <Badge variant="outline">ERP {c.external_id}</Badge>}
                <span className="text-sm tabular-nums">{brl(c.credit_limit)}</span>
                <CreditBadge status={c.credit_status} />
                <ActiveBadge active={c.is_active} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
