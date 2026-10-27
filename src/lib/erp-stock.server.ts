import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type SyncResult = { ok: boolean; message: string; updated: number; not_found: number };
type Creds = { endpoint_url?: string; stock_url?: string; api_key?: string; last_result?: unknown };

/** Lê o estoque do ERP (GET com [{sku, estoque}]) e atualiza products.stock_quantity da organização. */
export async function syncErpStock(sb: SupabaseClient<Database>, orgId: string): Promise<SyncResult> {
  const { data: cfgs } = await sb.from("integration_configs").select("id, integration_type, credentials")
    .eq("organization_id", orgId).in("integration_type", ["estoque", "erp"]).eq("is_active", true);
  const cfg = cfgs?.find((c) => c.integration_type === "estoque") ?? cfgs?.find((c) => c.integration_type === "erp");
  const creds = (cfg?.credentials ?? {}) as Creds;
  const url = creds.stock_url || creds.endpoint_url;
  if (!cfg || !url) return { ok: false, message: "Integração de estoque/ERP não configurada", updated: 0, not_found: 0 };

  let result: SyncResult;
  try {
    const res = await fetch(url, { headers: { accept: "application/json", ...(creds.api_key ? { authorization: `Bearer ${creds.api_key}` } : {}) } });
    if (!res.ok) throw new Error(`o ERP respondeu com erro ${res.status}`);
    const body = (await res.json()) as unknown;
    const rows = (Array.isArray(body) ? body : (body as { items?: unknown[] })?.items ?? []) as Record<string, unknown>[];
    if (!Array.isArray(rows)) throw new Error("resposta do ERP em formato inesperado");
    const { data: products } = await sb.from("products").select("id, sku, stock_quantity").eq("organization_id", orgId);
    const bySku = new Map((products ?? []).map((p) => [p.sku, p]));
    let updated = 0, notFound = 0;
    for (const r of rows) {
      const sku = String(r["sku"] ?? r["codigo"] ?? "");
      const qty = Number(r["stock_quantity"] ?? r["estoque"] ?? r["quantidade"]);
      const p = bySku.get(sku);
      if (!p) { notFound++; continue; }
      if (!Number.isFinite(qty) || p.stock_quantity === Math.trunc(qty)) continue;
      const { error } = await sb.from("products").update({ stock_quantity: Math.max(0, Math.trunc(qty)) }).eq("id", p.id);
      if (!error) updated++;
    }
    result = { ok: true, message: `Estoque sincronizado: ${updated} produto(s) atualizado(s)${notFound ? `, ${notFound} SKU(s) sem cadastro` : ""}`, updated, not_found: notFound };
  } catch (e) {
    result = { ok: false, message: `Falha ao sincronizar com o ERP: ${e instanceof Error ? e.message : "erro desconhecido"}. O estoque anterior foi mantido.`, updated: 0, not_found: 0 };
  }
  await sb.from("integration_configs").update({
    ...(result.ok ? { last_sync_at: new Date().toISOString() } : {}),
    credentials: { ...creds, last_result: { ...result, at: new Date().toISOString() } },
  }).eq("id", cfg.id);
  return result;
}
