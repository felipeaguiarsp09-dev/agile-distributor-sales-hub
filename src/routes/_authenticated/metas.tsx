import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { currentPeriod } from "@/lib/indicators";
import { parseCountTarget } from "@/lib/monthly-targets";
import { PageHeader } from "@/components/ModulePage";
import { ErrorState, NoAccess } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const DESC = "Metas mensais de clientes atendidos e visitas por vendedor.";
export const Route = createFileRoute("/_authenticated/metas")({
  head: () => ({ meta: [
    { title: "Metas mensais — Dcalice" }, { name: "description", content: DESC },
    { property: "og:title", content: "Metas mensais — Dcalice" }, { property: "og:description", content: DESC },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: MonthlyTargetsPage,
});

function MonthlyTargetsPage() {
  const { profile } = useAuth();
  const [period, setPeriod] = useState(currentPeriod());
  const allowed = profile?.role === "administrador" || profile?.role === "supervisor";
  const rows = useQuery({
    queryKey: ["monthly-targets", profile?.id, period],
    enabled: allowed && /^\d{4}-(0[1-9]|1[0-2])$/.test(period),
    retry: false,
    queryFn: async () => {
      if (!profile || !allowed) throw new Error("Sem acesso");
      let sellersQuery = supabase.from("profiles").select("id, full_name").eq("organization_id", profile.organization_id).eq("role", "vendedor").eq("is_active", true).order("full_name");
      if (profile.role === "supervisor") sellersQuery = sellersQuery.eq("supervisor_id", profile.id);
      const [sellers, goals] = await Promise.all([
        sellersQuery,
        supabase.from("sales_targets").select("id,seller_id,customer_target,visit_target").eq("organization_id", profile.organization_id).eq("period", period),
      ]);
      if (sellers.error) throw sellers.error;
      if (goals.error) throw goals.error;
      return (sellers.data ?? []).map(seller => ({ ...seller, goal: goals.data?.find(goal => goal.seller_id === seller.id) }));
    },
  });
  if (profile && !allowed) return <NoAccess />;
  return <div className="mx-auto max-w-5xl">
    <PageHeader title="Metas mensais" />
    <div className="mb-6 max-w-56 space-y-2"><Label htmlFor="target-month">Mês de referência</Label><Input id="target-month" type="month" value={period} onChange={e => setPeriod(e.target.value)} /></div>
    {rows.isError ? <ErrorState message="Não foi possível carregar as metas" onRetry={() => rows.refetch()} /> : rows.isPending ? <Skeleton className="h-40 w-full" /> : rows.data?.length === 0 ? <p className="py-10 text-center text-muted-foreground">Nenhum vendedor ativo neste período.</p> :
      <div className="divide-y border-y">{rows.data?.map(row => <TargetRow key={`${period}-${row.id}-${row.goal?.customer_target}-${row.goal?.visit_target}`} seller={row} period={period} orgId={profile?.organization_id ?? ""} />)}</div>}
  </div>;
}

type SellerRow = { id: string; full_name: string; goal?: { id: string; customer_target: number | null; visit_target: number | null } | undefined };
function TargetRow({ seller, period, orgId }: { seller: SellerRow; period: string; orgId: string }) {
  const qc = useQueryClient();
  const [customers, setCustomers] = useState(seller.goal?.customer_target == null ? "" : String(seller.goal.customer_target));
  const [visits, setVisits] = useState(seller.goal?.visit_target == null ? "" : String(seller.goal.visit_target));
  const [saving, setSaving] = useState(false);
  async function save() {
    try {
      const values = { customer_target: parseCountTarget(customers), visit_target: parseCountTarget(visits) };
      setSaving(true);
      const { error } = seller.goal
        ? await supabase.from("sales_targets").update(values).eq("id", seller.goal.id)
        : await supabase.from("sales_targets").insert({ ...values, organization_id: orgId, seller_id: seller.id, period, target_amount: 0 });
      if (error) throw error;
      await Promise.all([qc.invalidateQueries({ queryKey: ["monthly-targets"] }), qc.invalidateQueries({ queryKey: ["indicators"] })]);
      toast.success("Metas salvas");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar as metas"); }
    finally { setSaving(false); }
  }
  return <form onSubmit={e => { e.preventDefault(); void save(); }} className="grid items-end gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_150px_150px_auto]">
    <h2 className="self-center break-words font-semibold">{seller.full_name}</h2>
    <div className="space-y-2"><Label htmlFor={`customers-${seller.id}`}>Clientes atendidos</Label><Input id={`customers-${seller.id}`} type="number" min={0} step={1} inputMode="numeric" placeholder="Não definida" value={customers} disabled={saving} onChange={e => setCustomers(e.target.value)} /></div>
    <div className="space-y-2"><Label htmlFor={`visits-${seller.id}`}>Visitas</Label><Input id={`visits-${seller.id}`} type="number" min={0} step={1} inputMode="numeric" placeholder="Não definida" value={visits} disabled={saving} onChange={e => setVisits(e.target.value)} /></div>
    <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar</Button>
  </form>;
}