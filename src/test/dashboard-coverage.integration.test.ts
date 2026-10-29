import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { currentPeriod } from "@/lib/indicators";

// Opt-in authenticated check; never include session data in test output.
const sessionFile = process.env['LOVABLE_TEST_SESSION_FILE'];
describe.skipIf(!sessionFile)("live Dashboard coverage rules", () => {
  it("counts distinct purchasing customers, completed visits and remaining monthly goal", async () => {
    if (!sessionFile) return;
    const minted = JSON.parse(readFileSync(sessionFile, "utf8"));
    const sb = createClient(import.meta.env['VITE_SUPABASE_URL'], import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'], {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${minted.session.access_token}` } },
    });
    const sellerId = minted.session.user.id;
    const period = currentPeriod();
    const from = `${period}-01T00:00:00Z`;
    const to = new Date(from);
    to.setUTCMonth(to.getUTCMonth() + 1);
    const [orders, visits, target] = await Promise.all([
      sb.from("orders").select("customer_id,status").eq("seller_id", sellerId).gte("created_at", from).lt("created_at", to.toISOString()),
      sb.from("agenda_visits").select("status,check_in_at").eq("seller_id", sellerId).gte("check_in_at", from).lt("check_in_at", to.toISOString()),
      sb.from("sales_targets").select("id,customer_target,visit_target").eq("seller_id", sellerId).eq("period", period).single(),
    ]);
    expect(orders.error).toBeNull();
    expect(visits.error).toBeNull();
    expect(target.error).toBeNull();
    if (!target.data) throw new Error("A monthly target is required for the integration check");
    const goal = target.data;
    try {
      const update = await sb.from("sales_targets").update({ customer_target: 10, visit_target: 20 }).eq("id", goal.id);
      expect(update.error).toBeNull();
      const metrics = await sb.rpc("get_seller_indicators", { p_seller_id: sellerId, p_period: period });
      expect(metrics.error).toBeNull();
      const d = metrics.data as unknown as { clientes_atendidos: number; visitas_realizadas: number; meta_clientes: number; clientes_a_atender: number; meta_visitas: number; visitas_a_realizar: number };
      const customers = new Set((orders.data ?? []).filter(o => o.status === "aprovado" || o.status === "faturado").map(o => o.customer_id)).size;
      expect(d.clientes_atendidos).toBe(customers);
      expect(d.visitas_realizadas).toBe((visits.data ?? []).filter(v => v.status === "realizada").length);
      expect(d.meta_clientes).toBe(10);
      expect(d.clientes_a_atender).toBe(Math.max(10 - customers, 0));
      expect(d.meta_visitas).toBe(20);
      expect(d.visitas_a_realizar).toBe(Math.max(20 - d.visitas_realizadas, 0));
    } finally {
      const restore = await sb.from("sales_targets").update({ customer_target: goal.customer_target, visit_target: goal.visit_target }).eq("id", goal.id);
      expect(restore.error).toBeNull();
    }
  });

  it("lists exactly the portfolio customers without an approved/invoiced order in the month", async () => {
    if (!sessionFile) return;
    const minted = JSON.parse(readFileSync(sessionFile, "utf8"));
    const sb = createClient(import.meta.env['VITE_SUPABASE_URL'], import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'], {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${minted.session.access_token}` } },
    });
    const sellerId = minted.session.user.id;
    const period = currentPeriod();
    const from = `${period}-01T00:00:00Z`;
    const to = new Date(from);
    to.setUTCMonth(to.getUTCMonth() + 1);
    const [portfolio, orders, unserved] = await Promise.all([
      sb.from("customers").select("id").eq("owner_id", sellerId),
      sb.from("orders").select("customer_id,status").eq("seller_id", sellerId).gte("created_at", from).lt("created_at", to.toISOString()),
      sb.rpc("get_unserved_customers", { p_seller_id: sellerId, p_period: period }),
    ]);
    expect(portfolio.error).toBeNull();
    expect(orders.error).toBeNull();
    expect(unserved.error).toBeNull();
    const served = new Set((orders.data ?? []).filter(o => o.status === "aprovado" || o.status === "faturado").map(o => o.customer_id));
    const expected = (portfolio.data ?? []).filter(c => !served.has(c.id)).map(c => c.id).sort();
    const actual = (unserved.data as unknown as { id: string }[]).map(c => c.id).sort();
    expect(actual).toEqual(expected);
  });
});