import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { syncErpStockNow } from "@/lib/admin.functions";
import { PageHeader } from "@/components/ModulePage";
import { ErrorState, NoAccess, RowsSkeleton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/integracoes")({
  head: () => ({
    meta: [
      { title: "Integrações — Dcalice" },
      { name: "description", content: "Configure e acompanhe ERP, estoque e financeiro." },
      { property: "og:title", content: "Integrações — Dcalice" },
      { property: "og:description", content: "Configure e acompanhe ERP, estoque e financeiro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Field = { key: string; label: string; secret?: boolean; placeholder?: string };
const TYPES: { type: "erp" | "estoque" | "financeiro" | "pagamento"; title: string; hint: string; providers?: { value: string; label: string }[]; fields: (provider: string) => Field[] }[] = [
  { type: "erp", title: "ERP", hint: "Recebe os pedidos aprovados (botão Enviar ao ERP).", fields: () => [
    { key: "partner_api_url", label: "API do ERP parceiro", placeholder: "https://api.erpparceiro.com.br/v1" },
    { key: "endpoint_url", label: "Endereço para envio de pedidos", placeholder: "https://erp.suaempresa.com/api/pedidos" },
    { key: "api_key", label: "Chave de acesso", secret: true }] },
  { type: "estoque", title: "Estoque", hint: "Atualiza o estoque dos produtos a cada hora. Responde uma lista com sku e estoque.", fields: () => [
    { key: "stock_url", label: "Endereço da consulta de estoque", placeholder: "https://erp.suaempresa.com/api/estoque" },
    { key: "api_key", label: "Chave de acesso", secret: true }] },
  { type: "financeiro", title: "Financeiro", hint: "Consulta de títulos e crédito dos clientes.", fields: () => [
    { key: "endpoint_url", label: "Endereço da API financeira" },
    { key: "api_key", label: "Chave de acesso", secret: true }] },
];

type Cfg = { id: string; integration_type: string; provider: string | null; credentials: Record<string, unknown>; is_active: boolean; last_sync_at: string | null; organization_id: string };

function Page() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "administrador";
  const configs = useQuery({
    queryKey: ["integration_configs"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("integration_configs").select("*");
      if (error) throw error;
      return data as Cfg[];
    },
  });
  if (!isAdmin) return <NoAccess />;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Integrações" description="Conecte o ERP, o estoque e o financeiro, e acompanhe a última sincronização." />
      {configs.isLoading ? <RowsSkeleton rows={4} /> : configs.isError ? (
        <ErrorState message="Não foi possível carregar as integrações" onRetry={() => configs.refetch()} />
      ) : (
        <div className="space-y-4">
          {TYPES.map((t) => <IntegrationCard key={t.type} def={t} cfg={configs.data?.find((c) => c.integration_type === t.type)} orgId={profile!.organization_id} />)}
        </div>
      )}
    </div>
  );
}

function IntegrationCard({ def, cfg, orgId }: { def: (typeof TYPES)[number]; cfg: Cfg | undefined; orgId: string }) {
  const qc = useQueryClient();
  const syncFn = useServerFn(syncErpStockNow);
  const [provider, setProvider] = useState(cfg?.provider ?? def.providers?.[0]?.value ?? def.type);
  const [values, setValues] = useState<Record<string, string>>({});
  const [active, setActive] = useState(cfg?.is_active ?? false);
  const [busy, setBusy] = useState<"save" | "sync" | null>(null);
  useEffect(() => { setActive(cfg?.is_active ?? false); if (cfg?.provider) setProvider(cfg.provider); }, [cfg?.is_active, cfg?.provider]);

  const creds = cfg?.credentials ?? {};
  const last = creds["last_result"] as { ok: boolean; message: string; at: string } | undefined;
  const fields = def.fields(provider);
  const webhook = typeof window !== "undefined" ? `${window.location.origin}/api/public/payment-webhook?provider=${provider}&org=${orgId}` : "";

  async function save() {
    setBusy("save");
    const next: Record<string, unknown> = { ...(cfg?.provider === provider ? creds : { last_result: creds["last_result"] }) };
    for (const f of fields) {
      const v = (values[f.key] ?? "").trim();
      if (v) next[f.key] = v;
      else if (!f.secret) delete next[f.key];
    }
    const row = { organization_id: orgId, integration_type: def.type, provider, credentials: next as never, is_active: active };
    const { error } = cfg ? await supabase.from("integration_configs").update(row).eq("id", cfg.id) : await supabase.from("integration_configs").insert(row);
    setBusy(null);
    if (error) return void toast.error("Não foi possível salvar a integração");
    toast.success(`${def.title} salvo`);
    setValues({});
    void qc.invalidateQueries({ queryKey: ["integration_configs"] });
  }
  async function sync() {
    setBusy("sync");
    try {
      const r = await syncFn();
      toast[r.ok ? "success" : "error"](r.message);
    } catch {
      toast.error("Falha ao sincronizar com o ERP. Tente novamente em instantes.");
    } finally {
      setBusy(null);
      void qc.invalidateQueries({ queryKey: ["integration_configs"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
    }
  }

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">{def.title}</h2>
        <Badge variant={cfg?.is_active ? "secondary" : "outline"}>{cfg ? (cfg.is_active ? "Ativa" : "Desativada") : "Não configurada"}</Badge>
        <label className="ml-auto flex items-center gap-2 text-sm">Ativa <Switch checked={active} onCheckedChange={setActive} /></label>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{def.hint}</p>
      {(cfg?.last_sync_at || last) && (
        <p className={`mt-2 text-sm ${last && !last.ok ? "text-destructive" : "text-muted-foreground"}`}>
          {cfg?.last_sync_at && `Última sincronização: ${new Date(cfg.last_sync_at).toLocaleString("pt-BR")}. `}
          {last && `${last.message} (${new Date(last.at).toLocaleString("pt-BR")})`}
        </p>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {def.providers && (
          <div className="space-y-1">
            <Label>Serviço</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{def.providers.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        {fields.map((f) => {
          const has = cfg?.provider === provider && !!creds[f.key];
          return (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={`${def.type}-${f.key}`}>{f.label}</Label>
              <Input id={`${def.type}-${f.key}`} type={f.secret ? "password" : "url"} autoComplete="off"
                placeholder={f.secret ? (has ? "•••••• (guardada — preencha só para trocar)" : "") : f.placeholder}
                value={values[f.key] ?? (f.secret ? "" : String(cfg?.provider === provider ? creds[f.key] ?? "" : ""))}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
            </div>
          );
        })}
      </div>
      {def.type === "pagamento" && (
        <p className="mt-3 break-all text-xs text-muted-foreground">Endereço de aviso de pagamento (cadastre no painel do serviço): <code>{webhook}</code></p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={busy !== null} onClick={save}>{busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />} Salvar</Button>
        {(def.type === "estoque" || def.type === "erp") && cfg?.is_active && (
          <Button variant="outline" disabled={busy !== null} onClick={sync}>{busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sincronizar estoque agora</Button>
        )}
      </div>
    </section>
  );
}
