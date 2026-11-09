import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, ShoppingCart, Sparkles, Target, TriangleAlert } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { subscribeDashboardOrders } from "@/lib/dashboard-realtime";
import { currentPeriod, dailyVisitTarget, insightScope, lastPeriods, lastUpdatedLabel, progressPct, unmetTargets } from "@/lib/indicators";
import { generateIndicatorInsight, getDashboardIndicators, getUnservedCustomers } from "@/lib/indicators.functions";
import { PageHeader } from "@/components/ModulePage";
import { ErrorState, NoAccess, brl } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const unservedFn = useServerFn(getUnservedCustomers);
  const [period, setPeriod] = useState(currentPeriod());
  const [seller, setSeller] = useState<string>(ALL);
  const [generating, setGenerating] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  const [unservedOpen, setUnservedOpen] = useState(false);
  const role = profile?.role;
  const isManager = role === "supervisor" || role === "administrador";
  const sellerId = seller === ALL ? null : seller;
  const indicatorsReady = ready && !!profile && session?.user.id === profile.id && role !== "cliente";

  useEffect(() => {
    if (!indicatorsReady || !profile?.id) return;
    return subscribeDashboardOrders(supabase, qc, profile.id);
  }, [indicatorsReady, profile?.id, qc]);

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

  const unserved = useQuery({
    queryKey: ["unserved-customers", profile?.id, period, sellerId],
    enabled: indicatorsReady && unservedOpen,
    retry: false,
    queryFn: () => unservedFn({ data: { period, seller_id: sellerId } }),
  });

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
  const billed = d ? Number(d.faturado_mes ?? 0) : 0;
  const pct = d ? progressPct(d.meta, billed) : 0;
  const unmet = unmetTargets(d);
  const anyTarget = !!d && (d.meta > 0 || d.meta_clientes != null || d.meta_visitas != null);
  const unmetCount = [unmet.sales, unmet.customers, unmet.visits].filter((x) => x != null).length;
  const scopeLabel = sellerId ? sellers.data?.find((s) => s.id === sellerId)?.full_name : role === "administrador" ? "Toda a distribuidora" : role === "supervisor" ? "Sua equipe" : "Seus números";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Dashboard" description={DESC} />

      <div className="mb-6 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
        <Label htmlFor="dashboard-month">Mês de referência</Label>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger id="dashboard-month" className="w-56" aria-label="Mês de referência"><SelectValue /></SelectTrigger>
          <SelectContent>
            {lastPeriods(36).map((p) => <SelectItem key={p} value={p} className="capitalize">{periodLabel(p)}</SelectItem>)}
          </SelectContent>
        </Select>
        </div>
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
        {isManager && <Button variant="outline" asChild><Link to="/metas"><Target className="h-4 w-4" /> Metas mensais</Link></Button>}
        <span className="text-sm text-muted-foreground">{scopeLabel}</span>
        {!indicatorsLoading && (
          <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
            {ind.isFetching && <Loader2 className="h-3 w-3 animate-spin" aria-label="Atualizando" />}
            {ind.isError && ind.data && (
              <span className="flex items-center gap-1 font-medium">
                <TriangleAlert className="h-3 w-3" aria-hidden />
                Falha na atualização · mostrando dados anteriores
              </span>
            )}
            {lastUpdatedLabel(ind.dataUpdatedAt)}
          </span>
        )}
      </div>

      {ind.isError && !ind.data ? (
        <ErrorState message="Não foi possível carregar os indicadores" onRetry={() => ind.refetch()} />
      ) : (
        <>
          {d && d.meta > 0 && (
            <div className="mb-4 rounded-lg border bg-card p-4" aria-label="Progresso da meta de faturamento">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">Meta × realizado (faturado)</span>
                <span className={unmet.sales != null ? "font-semibold text-destructive" : "font-semibold text-success"}>
                  {unmet.sales != null ? `Faltam ${brl(unmet.sales)} para a meta` : "Meta batida"}
                </span>
              </div>
              <div className="relative mx-auto h-44 w-44">
                <PieChart width={176} height={176}>
                  <Pie data={[{ v: Math.min(pct, 100) }, { v: Math.max(100 - pct, 0) }]} dataKey="v" innerRadius={58} outerRadius={80} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                    <Cell fill={unmet.sales == null ? "var(--success)" : "var(--danger)"} />
                    <Cell fill="var(--muted)" />
                  </Pie>
                </PieChart>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-bold tabular-nums">{pct}%</span>
                  <span className="text-xs text-muted-foreground">{brl(billed)}</span>
                  <span className="text-xs text-muted-foreground">de {brl(d.meta)}</span>
                </div>
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                {brl(billed)} faturado de {brl(d.meta)} · {pct}% atingido · atualiza sozinho quando um pedido é faturado
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <Kpi
              label="Meta × faturado"
              value={d && d.meta > 0 ? `${brl(billed)} de ${brl(d.meta)}` : null}
              hint={d && d.meta > 0 ? (unmet.sales != null ? `Faltam ${brl(unmet.sales)} · ${pct}% atingido` : `Meta batida · ${pct}%`) : "Meta não definida"}
              attention={unmet.sales != null}
              met={!!d && d.meta > 0 && unmet.sales == null}
              loading={indicatorsLoading}
            />
            <Kpi
              label="Positivação / venda"
              value={d ? `${d.clientes_positivados ?? 0} cliente${(d.clientes_positivados ?? 0) === 1 ? "" : "s"} · ${brl(d.vendas_mes)}` : null}
              hint={d?.meta_clientes != null ? (unmet.customers != null ? `Faltam ${unmet.customers} clientes · ${progressPct(d.meta_clientes, d.clientes_positivados ?? 0)}% da meta` : "Meta de clientes batida") : "Clientes que compraram no mês"}
              attention={unmet.customers != null}
              met={d?.meta_clientes != null && unmet.customers == null}
              loading={indicatorsLoading}
            />
            <Kpi label="Valor" value={d ? brl(d.vendas_mes) : null} hint={d ? `${d.pedidos_count} pedido(s) · faturado ${brl(billed)}` : undefined} loading={indicatorsLoading} />
            <Kpi
              label="Visitas"
              value={d ? String(d.visitas_realizadas) : null}
              hint={d?.meta_visitas != null ? `Meta ${d.meta_visitas} ÷ 30 = ${dailyVisitTarget(d.meta_visitas) ?? 0} por dia${unmet.visits != null ? ` · faltam ${unmet.visits}` : " · meta batida"}` : "Meta de visitas não definida"}
              attention={unmet.visits != null}
              met={d?.meta_visitas != null && unmet.visits == null}
              loading={indicatorsLoading}
            />
            <Kpi label="Clientes novos" value={d ? String(d.clientes_ativados ?? 0) : null} hint="Primeira compra no mês" loading={indicatorsLoading} />
            <Kpi label="Devolução" value={d ? brl(d.devolucao ?? 0) : null} hint="Informada pelo ERP" loading={indicatorsLoading} />
          </div>
          <div className="mt-4">
            <Kpi label="Clientes a positivar" value={d?.clientes_a_atender != null ? String(d.clientes_a_atender) : null} hint="Toque para ver os clientes da carteira sem pedido no mês" loading={indicatorsLoading} onClick={() => setUnservedOpen(true)} />
          </div>

          {!indicatorsLoading && d && unmetCount > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-4">
              <span className="text-sm font-semibold">Metas não atingidas em {periodLabel(period)}:</span>
              {unmet.sales != null && <span className="rounded-full bg-danger px-3 py-1 text-xs font-semibold text-danger-foreground">Faltam {brl(unmet.sales)} em faturamento</span>}
              {unmet.customers != null && <span className="rounded-full bg-danger px-3 py-1 text-xs font-semibold text-danger-foreground">Faltam {unmet.customers} clientes</span>}
              {unmet.visits != null && <span className="rounded-full bg-danger px-3 py-1 text-xs font-semibold text-danger-foreground">Faltam {unmet.visits} visitas</span>}
            </div>
          )}
          {!indicatorsLoading && d && unmetCount === 0 && anyTarget && (
            <p className="mt-4 text-sm text-muted-foreground">Todas as metas definidas foram atingidas em {periodLabel(period)}.</p>
          )}
          <section className="mt-6 border-t pt-5">
            <h2 className="mb-2 text-sm font-semibold">Vendas por dia</h2>
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
            <div className="mt-6">
              <Kpi label="Ticket médio" value={d && d.pedidos_count > 0 ? brl(d.ticket_medio) : null} loading={indicatorsLoading} />
            </div>
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

      <UnservedDialog open={unservedOpen} onOpenChange={setUnservedOpen} period={period} query={unserved} />
      {sellerId && profile && (
        <MetaDialog open={metaOpen} onOpenChange={setMetaOpen} sellerId={sellerId} period={period} orgId={profile.organization_id} current={d?.meta ?? 0} currentCustomers={d?.meta_clientes ?? null} />
      )}
    </div>
  );
}

function Kpi({ label, value, hint, loading, attention, met, onClick }: { label: string; value: string | null; hint?: string | undefined; loading: boolean; attention?: boolean; met?: boolean; onClick?: () => void }) {
  const className = (attention && !loading ? "rounded-lg border border-danger bg-card p-5 ring-1 ring-danger/40" : met && !loading ? "rounded-lg border border-success bg-card p-5 ring-1 ring-success/40" : "rounded-lg border bg-card p-5") + (onClick ? " w-full cursor-pointer text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : "");
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {attention && !loading && <span className="whitespace-nowrap rounded-full bg-danger px-2 py-0.5 text-[11px] font-semibold text-danger-foreground">Meta não batida</span>}
        {met && !attention && !loading && <span className="whitespace-nowrap rounded-full bg-success px-2 py-0.5 text-[11px] font-semibold text-success-foreground">Meta batida</span>}
      </div>
      {loading ? <Skeleton className="mt-2 h-8 w-32" /> : value ? <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p> : <p className="mt-2 text-sm text-muted-foreground">Sem dados para o período</p>}
      {hint && !loading && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  return onClick ? <button type="button" className={className} onClick={onClick}>{body}</button> : <div className={className}>{body}</div>;
}

function UnservedDialog({ open, onOpenChange, period, query }: { open: boolean; onOpenChange: (o: boolean) => void; period: string; query: { data: { id: string; name: string; cnpj_cpf: string | null; phone: string | null }[] | undefined; isPending: boolean; isError: boolean; refetch: () => void } }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="pr-6">Clientes ainda não atendidos em {periodLabel(period)}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Clientes da carteira sem pedido aprovado ou faturado no mês selecionado.</p>
        {query.isPending ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : query.isError ? (
          <ErrorState message="Não foi possível carregar a lista de clientes" onRetry={() => query.refetch()} />
        ) : !query.data || query.data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Todos os clientes da carteira já foram atendidos neste mês.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {query.data.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-4 py-3">
                <Link to="/clientes/$id" params={{ id: c.id }} className="min-w-0 flex-1 transition-colors hover:opacity-80">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{[c.cnpj_cpf, c.phone].filter(Boolean).join(" · ") || "Sem contato cadastrado"}</p>
                </Link>
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link to="/pedidos/novo" search={{ cliente: c.id }} aria-label={`Novo pedido para ${c.name}`}>
                    <ShoppingCart className="h-4 w-4" />
                    Novo pedido
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
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
