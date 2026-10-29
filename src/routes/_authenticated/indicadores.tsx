import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, Sparkles, Target } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { currentPeriod, insightScope, lastPeriods, progressPct } from "@/lib/indicators";
import { generateIndicatorInsight, getDashboardIndicators } from "@/lib/indicators.functions";
import { PageHeader } from "@/components/ModulePage";
import { ErrorState, NoAccess, brl } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const DESC = "Vendas, atendimento de clientes, metas e visitas realizadas.";

export const Route = createFileRoute("/_authenticated/indicadores")({
  head: () => ({
    meta: [
      { title: "Dashboard — Dcalice" },
      { name: "description", content: DESC },
      { property: "og:title", content: "Dashboard — Dcalice" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IndicatorsPage,
});

const ALL = "__all";
const periodLabel = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return new Date(y ?? 2026, (m ?? 1) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

function IndicatorsPage() {
  const { profile, ready, session } = useAuth();
  const qc = useQueryClient();
  const insightFn = useServerFn(generateIndicatorInsight);
  const indicatorsFn = useServerFn(getDashboardIndicators);
  const [period, setPeriod] = useState(currentPeriod());
  const [seller, setSeller] = useState<string>(ALL);
  const [generating, setGenerating] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  const role = profile?.role;
  const isManager = role === "supervisor" || role === "administrador";
  const sellerId = seller === ALL ? null : seller;
  const indicatorsReady = ready && !!profile && session?.user.id === profile.id && role !== "cliente";

  const sellers = useQuery({
    queryKey: ["indicator-sellers", role, profile?.id],
    enabled: isManager,
    queryFn: async () => {
      let q = supabase.from("profiles").select("id, full_name").in("role", ["vendedor", "administrador"]).eq("is_active", true).order("full_name");
      if (role === "supervisor" && profile) q = q.eq("supervisor_id", profile.id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const ind = useQuery({
    queryKey: ["indicators", profile?.id, period, sellerId],
    enabled: indicatorsReady,
    retry: false,
    queryFn: () => indicatorsFn({ data: { period, seller_id: sellerId } }),
  });
  const indicatorsLoading = !indicatorsReady || ind.isPending;

  const scope = profile && role !== "cliente" ? insightScope(role, profile.id, sellerId) : null;
  const insight = useQuery({
    queryKey: ["indicator-insight", period, scope?.scope, scope?.scope_ref_id],
    enabled: !!scope,
    queryFn: async () => {
      let q = supabase.from("indicator_insights").select("insight_text, generated_at").eq("period", period).eq("scope", scope!.scope);
      q = scope!.scope_ref_id ? q.eq("scope_ref_id", scope!.scope_ref_id) : q.is("scope_ref_id", null);
      const { data, error } = await q.order("generated_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (role === "cliente") return <NoAccess />;

  async function generate() {
    setGenerating(true);
    try {
      await insightFn({ data: { period, seller_id: sellerId } });
      await qc.invalidateQueries({ queryKey: ["indicator-insight"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar a análise agora");
    } finally {
      setGenerating(false);
    }
  }

  const d = ind.data;
  const empty = d && d.meta === 0 && d.pedidos_count === 0;
  const pct = d ? progressPct(d.meta, d.vendas_mes) : 0;
  const scopeLabel = sellerId ? sellers.data?.find((s) => s.id === sellerId)?.full_name : role === "administrador" ? "Toda a distribuidora" : role === "supervisor" ? "Sua equipe" : "Seus números";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Dashboard" description={DESC} />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {lastPeriods(36).map((p) => <SelectItem key={p} value={p} className="capitalize">{periodLabel(p)}</SelectItem>)}
          </SelectContent>
        </Select>
        {isManager && (
          <Select value={seller} onValueChange={setSeller}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{role === "administrador" ? "Toda a distribuidora" : "Toda a equipe"}</SelectItem>
              {sellers.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {isManager && sellerId && (
          <Button variant="outline" onClick={() => setMetaOpen(true)}><Target className="h-4 w-4" /> Definir meta</Button>
        )}
        <span className="text-sm text-muted-foreground">{scopeLabel}</span>
      </div>

      {ind.isError ? (
        <ErrorState message="Não foi possível carregar os indicadores" onRetry={() => ind.refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Kpi label="Meta" value={d && d.meta > 0 ? brl(d.meta) : null} loading={indicatorsLoading} />
            <Kpi label="Vendas do mês" value={d && !empty ? brl(d.vendas_mes) : null} hint={d && d.pedidos_count ? `${d.pedidos_count} pedido(s) aprovado(s)/faturado(s)` : undefined} loading={indicatorsLoading} />
            <Kpi label="Ticket médio" value={d && d.pedidos_count > 0 ? brl(d.ticket_medio) : null} loading={indicatorsLoading} />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Kpi label="Clientes atendidos" value={d ? String(d.clientes_atendidos) : null} hint="Com pedido aprovado ou faturado no mês" loading={indicatorsLoading} />
            <Kpi label="Clientes a atender" value={d?.clientes_a_atender != null ? String(d.clientes_a_atender) : null} hint={d?.meta_clientes != null ? `Meta mensal: ${d.meta_clientes} clientes` : "Meta de clientes não definida"} loading={indicatorsLoading} />
            <Kpi label="Visitas realizadas" value={d ? String(d.visitas_realizadas) : null} hint="Visitas concluídas com check-in no mês" loading={indicatorsLoading} />
          </div>
          <section className="mt-6 border-t pt-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold">Meta × realizado</span>
              <span className="tabular-nums text-muted-foreground">{d && d.meta > 0 ? `${pct}%` : "Sem meta no período"}</span>
            </div>
            {indicatorsLoading ? <Skeleton className="h-3 w-full" /> : <Progress value={Math.min(pct, 100)} />}
            <h2 className="mb-2 mt-6 text-sm font-semibold">Vendas por dia</h2>
            {indicatorsLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : d && d.daily.length > 0 ? (
              <ChartContainer config={{ total: { label: "Vendas", color: "var(--primary)" } }} className="h-56 w-full">
                <BarChart data={d.daily.map((x) => ({ day: x.day.slice(8, 10), total: Number(x.total) }))}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={70} tickFormatter={(v: number) => brl(v).replace(",00", "")} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => brl(Number(v))} />} />
                  <Bar dataKey="total" fill="var(--color-total)" radius={4} />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">Sem dados para o período</p>
            )}
          </section>
        </>
      )}

      <section className="mt-6 border-t pt-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="flex-1 font-semibold">Análise da IA</h2>
          <Button size="sm" variant="outline" disabled={generating || indicatorsLoading || ind.isError} onClick={generate}>
            {generating && <Loader2 className="h-4 w-4 animate-spin" />} {insight.data ? "Atualizar análise" : "Gerar análise"}
          </Button>
        </div>
        {generating ? (
          <p className="text-sm text-muted-foreground">Gerando leitura...</p>
        ) : insight.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando análise...</p>
        ) : insight.isError ? (
          <p className="text-sm text-destructive">
            Não foi possível carregar a análise.{" "}
            <button className="underline" onClick={() => insight.refetch()}>Tentar novamente</button>
          </p>
        ) : insight.data ? (
          <>
            <p className="text-sm leading-relaxed">{insight.data.insight_text}</p>
            <p className="mt-2 text-xs text-muted-foreground">Gerada em {new Date(insight.data.generated_at).toLocaleString("pt-BR")} · apoio à decisão</p>
          </>
        ) : empty ? (
          <p className="text-sm text-muted-foreground">Ainda não há metas nem vendas neste período. Importe a base ou cadastre metas para a IA ter o que analisar.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma análise para este período ainda.</p>
        )}
      </section>

      {sellerId && profile && (
        <MetaDialog open={metaOpen} onOpenChange={setMetaOpen} sellerId={sellerId} period={period} orgId={profile.organization_id} current={d?.meta ?? 0} currentCustomers={d?.meta_clientes ?? null} />
      )}
    </div>
  );
}

function Kpi({ label, value, hint, loading }: { label: string; value: string | null; hint?: string | undefined; loading: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      {loading ? <Skeleton className="mt-2 h-8 w-32" /> : value ? <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p> : <p className="mt-2 text-sm text-muted-foreground">Sem dados para o período</p>}
      {hint && !loading && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MetaDialog({ open, onOpenChange, sellerId, period, orgId, current, currentCustomers }: { open: boolean; onOpenChange: (o: boolean) => void; sellerId: string; period: string; orgId: string; current: number; currentCustomers: number | null }) {
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [customerValue, setCustomerValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(String(current).replace(".", ","));
    setCustomerValue(currentCustomers === null ? "" : String(currentCustomers));
  }, [open, current, currentCustomers]);

  async function save() {
    const amount = Number(value.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0) return void toast.error("Informe um valor válido");
    const customerTarget = customerValue.trim() === "" ? null : Number(customerValue);
    if (customerTarget !== null && (!Number.isInteger(customerTarget) || customerTarget < 0)) return void toast.error("Informe uma quantidade inteira de clientes");
    setSaving(true);
    const { data: existing, error: readError } = await supabase.from("sales_targets").select("id").eq("seller_id", sellerId).eq("period", period).maybeSingle();
    if (readError) { setSaving(false); toast.error("Não foi possível carregar a meta atual"); return; }
    const { error } = existing
      ? await supabase.from("sales_targets").update({ target_amount: amount, customer_target: customerTarget }).eq("id", existing.id)
      : await supabase.from("sales_targets").insert({ organization_id: orgId, seller_id: sellerId, period, target_amount: amount, customer_target: customerTarget });
    setSaving(false);
    if (error) return void toast.error(error.message);
    toast.success("Meta salva");
    onOpenChange(false);
    await qc.invalidateQueries({ queryKey: ["indicators"] });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) { setValue(current ? String(current).replace(".", ",") : ""); setCustomerValue(currentCustomers === null ? "" : String(currentCustomers)); } onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Meta de {periodLabel(period)}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="meta">Valor da meta (R$)</Label>
          <Input id="meta" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="100000,00" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="customer-meta">Meta de clientes atendidos</Label>
          <Input id="customer-meta" type="number" min={0} step={1} inputMode="numeric" value={customerValue} onChange={(e) => setCustomerValue(e.target.value)} placeholder="Não definida" />
        </div>
        <DialogFooter>
          <Button disabled={saving} onClick={save}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar meta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
