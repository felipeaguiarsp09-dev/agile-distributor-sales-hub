/** Rotinas agendadas (sem usuário logado): rodam com acesso privilegiado para cada organização. */
import { z } from "zod";
import { syncErpStock } from "./erp-stock.server";

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}
const spPeriod = (d = new Date()) => d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);

export async function runStockSyncAll() {
  const sb = await admin();
  const { data } = await sb.from("integration_configs").select("organization_id").in("integration_type", ["estoque", "erp"]).eq("is_active", true);
  const orgs = [...new Set((data ?? []).map((r) => r.organization_id))];
  const results = [];
  for (const org of orgs) results.push({ org, ...(await syncErpStock(sb, org)) });
  return results;
}

export async function runIndicatorInsightAll() {
  const sb = await admin();
  const { generateStructured } = await import("./ai.server");
  const period = spPeriod();
  const start = new Date(`${period}-01T00:00:00-03:00`);
  const end = new Date(start); end.setMonth(end.getMonth() + 1);
  const { data: orgs } = await sb.from("organizations").select("id");
  const out = [];
  for (const { id: org } of orgs ?? []) {
    const [{ data: orders }, { data: targets }] = await Promise.all([
      sb.from("orders").select("total_amount, created_at").eq("organization_id", org).in("status", ["aprovado", "faturado"]).gte("created_at", start.toISOString()).lt("created_at", end.toISOString()),
      sb.from("sales_targets").select("target_amount").eq("organization_id", org).eq("period", period),
    ]);
    const vendas = (orders ?? []).reduce((s, o) => s + Number(o.total_amount), 0);
    const count = orders?.length ?? 0;
    const meta = (targets ?? []).reduce((s, t) => s + Number(t.target_amount), 0);
    const snapshot = { meta, vendas_mes: vendas, ticket_medio: count ? Math.round((vendas / count) * 100) / 100 : 0, pedidos_count: count };
    if (!meta && !count) { out.push({ org, skipped: true }); continue; }
    try {
      const r = await generateStructured(
        z.object({ insight_text: z.string() }),
        "Você é um analista comercial de uma distribuidora. Escreva em português, em 2 a 4 frases curtas, a leitura da manhã sobre os indicadores do mês de toda a distribuidora e uma recomendação prática. Não invente números.",
        JSON.stringify({ periodo: period, ...snapshot }),
      );
      await sb.from("indicator_insights").insert({ organization_id: org, scope: "global", scope_ref_id: null, period, insight_text: r.insight_text, metrics_snapshot: snapshot });
      out.push({ org, ok: true });
    } catch (e) {
      console.error("generate-indicator-insight cron", e);
      out.push({ org, ok: false });
    }
  }
  return out;
}

/** Previsão da próxima semana: média semanal das últimas 12 semanas, com justificativa da IA quando disponível. */
export async function runDemandForecastAll() {
  const sb = await admin();
  const { generateStructured } = await import("./ai.server");
  const since = new Date(Date.now() - 84 * 86400_000);
  const periodStart = new Date(); periodStart.setDate(periodStart.getDate() + ((8 - periodStart.getDay()) % 7 || 7));
  const ps = periodStart.toLocaleDateString("sv-SE");
  const pe = new Date(periodStart.getTime() + 6 * 86400_000).toLocaleDateString("sv-SE");
  const { data: orgs } = await sb.from("organizations").select("id");
  const out = [];
  for (const { id: org } of orgs ?? []) {
    const { data: items } = await sb.from("order_items")
      .select("product_id, quantity, orders!inner(organization_id, status, created_at), products(name)")
      .eq("orders.organization_id", org).in("orders.status", ["aprovado", "faturado"]).gte("orders.created_at", since.toISOString());
    const byProduct = new Map<string, { name: string; qty: number }>();
    for (const i of items ?? []) {
      const cur = byProduct.get(i.product_id) ?? { name: i.products?.name ?? "", qty: 0 };
      cur.qty += i.quantity;
      byProduct.set(i.product_id, cur);
    }
    const rows = [...byProduct.entries()].map(([id, v]) => ({ product_id: id, name: v.name, forecast: Math.round((v.qty / 12) * 10) / 10 }));
    if (!rows.length) { out.push({ org, products: 0 }); continue; }
    let reasons = new Map<string, string>();
    try {
      const r = await generateStructured(
        z.object({ items: z.array(z.object({ product_id: z.string(), rationale: z.string() })) }),
        "Para cada produto, escreva em português uma frase curta explicando a previsão de demanda da próxima semana (média das últimas 12 semanas de vendas). Use os product_id informados.",
        JSON.stringify(rows.slice(0, 50)),
      );
      reasons = new Map(r.items.map((x) => [x.product_id, x.rationale]));
    } catch (e) {
      console.error("generate-demand-forecast ai", e);
    }
    const { error } = await sb.from("demand_forecasts").insert(rows.map((r) => ({
      organization_id: org, product_id: r.product_id, period_start: ps, period_end: pe, forecast_quantity: r.forecast,
      confidence: 0.6, rationale: reasons.get(r.product_id) ?? "Média semanal das últimas 12 semanas de vendas.",
    })));
    out.push({ org, products: rows.length, ok: !error });
  }
  return out;
}
