import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { importErpData } from "@/lib/import.functions";
import { PageHeader } from "@/components/ModulePage";
import { EmptyState, ErrorState, NoAccess, RowsSkeleton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/importacao")({
  head: () => ({
    meta: [
      { title: "Importação da base — Dcalice" },
      { name: "description", content: "Migre clientes e produtos da planilha ou do ERP para o Dcalice." },
      { property: "og:title", content: "Importação da base — Dcalice" },
      { property: "og:description", content: "Migre clientes e produtos da planilha ou do ERP para o Dcalice." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImportPage,
});

const ENTITY_LABEL: Record<string, string> = { customers: "Clientes", products: "Produtos", orders: "Pedidos" };
const STATUS_LABEL: Record<string, string> = { pendente: "Pendente", processando: "Processando", concluido: "Concluído", erro: "Erro" };

function ImportPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [entity, setEntity] = useState("customers");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const jobs = useQuery({
    queryKey: ["import_jobs"],
    enabled: profile?.role === "administrador",
    refetchInterval: busy ? 2000 : false,
    queryFn: async () => {
      const { data, error } = await supabase.from("import_jobs").select("*").order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data;
    },
  });

  if (profile?.role !== "administrador") return <NoAccess />;

  async function handleImport() {
    if (!file || !profile) return;
    setBusy(true);
    try {
      const safeName = file.name.replace(/[^\w.-]+/g, "_");
      const path = `${profile.organization_id}/${entity}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("imports").upload(path, file, { contentType: "text/csv" });
      if (upErr) throw new Error("Não foi possível enviar o arquivo");
      const { data: job, error } = await supabase
        .from("import_jobs")
        .insert({ organization_id: profile.organization_id, entity_type: entity, file_url: path, created_by: profile.id })
        .select()
        .single();
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["import_jobs"] });
      const res = await importErpData({ data: { import_job_id: job.id } });
      toast[res.status === "concluido" ? "success" : "error"](
        `${res.rows_imported} de ${res.rows_total} linhas importadas`,
      );
      setFile(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na importação");
    } finally {
      await qc.refetchQueries({ queryKey: ["import_jobs"] });
      setBusy(false);
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
      void qc.invalidateQueries({ queryKey: ["orders"] });
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Importação da base" description="Traga clientes, produtos e pedidos da planilha ou do ERP. Reimportar atualiza pelo código do ERP, sem duplicar." />

      <div className="grid gap-4 rounded-lg border bg-card p-5 shadow-card sm:grid-cols-[180px_1fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label>Tipo de dado</Label>
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="customers">Clientes</SelectItem>
              <SelectItem value="products">Produtos</SelectItem>
              <SelectItem value="orders">Pedidos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="file">Arquivo CSV (exportado da planilha/ERP)</Label>
          <Input id="file" type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <Button onClick={handleImport} disabled={!file || busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Importar
        </Button>
      </div>

      <details className="mt-3 text-sm text-muted-foreground">
        <summary className="cursor-pointer">Formato do arquivo</summary>
        <p className="mt-2"><strong>Clientes:</strong> codigo, nome, cnpj_cpf, email, telefone, endereco, cidade, uf, cep, limite_de_credito, situacao (ok/restrito/bloqueado), vendedor (nome completo; vazio = administrador).</p>
        <p className="mt-1"><strong>Produtos:</strong> codigo, sku, nome, descricao, categoria, preco, estoque, ecommerce (sim/não), ativo (sim/não).</p>
        <p className="mt-1"><strong>Pedidos:</strong> uma linha por item — codigo_pedido, codigo_cliente, sku, quantidade, preco_unitario (vazio = preço do catálogo), data (dd/mm/aaaa), status (padrão faturado), desconto, vendedor. Importe clientes e produtos antes.</p>
        <p className="mt-1">Separador vírgula ou ponto e vírgula; valores como 1.234,56 são aceitos.</p>
      </details>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Importações</h2>
      {jobs.isLoading ? (
        <RowsSkeleton rows={3} />
      ) : jobs.isError ? (
        <ErrorState message="Não foi possível carregar as importações" onRetry={() => jobs.refetch()} />
      ) : !jobs.data?.length ? (
        <EmptyState title="Nenhuma importação realizada ainda">Escolha o tipo, envie o CSV e clique em Importar.</EmptyState>
      ) : (
        <div className="space-y-3">
          {jobs.data.map((j) => {
            const log = (j.error_log as { row: number; error: string }[]) ?? [];
            return (
              <div key={j.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{ENTITY_LABEL[j.entity_type]}</span>
                  <span className="text-sm text-muted-foreground">{j.file_url?.split("/").pop()?.replace(/^\d+-/, "")}</span>
                  <Badge variant={j.status === "erro" ? "destructive" : j.status === "concluido" ? "secondary" : "outline"} className="ml-auto">
                    {STATUS_LABEL[j.status]}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {j.rows_imported} de {j.rows_total} linhas · {new Date(j.created_at).toLocaleString("pt-BR")}
                </p>
                {j.status === "processando" && <Progress className="mt-2" value={j.rows_total ? (j.rows_imported / j.rows_total) * 100 : 10} />}
                {log.length > 0 && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-destructive">{log.length} linha(s) rejeitada(s)</summary>
                    <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
                      {log.map((e, i) => (
                        <li key={i}>Linha {e.row}: {e.error}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
