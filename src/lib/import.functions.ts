import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isRowError, toCustomer, toProduct, type RowError } from "./import-rows";

type Input = { import_job_id: string; rows: Record<string, string>[] };

/** import-erp-data: processa um import_jobs com as linhas lidas da planilha/ERP. */
export const importErpData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Input) => {
    if (!d?.import_job_id || !Array.isArray(d.rows)) throw new Error("Dados inválidos");
    if (d.rows.length > 20000) throw new Error("Arquivo grande demais (máx. 20.000 linhas)");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: me } = await sb.from("profiles").select("id, role, organization_id").eq("id", context.userId).single();
    if (!me || me.role !== "administrador") throw new Error("Apenas o administrador pode importar");

    const { data: job } = await sb.from("import_jobs").select("*").eq("id", data.import_job_id).single();
    if (!job) throw new Error("Importação não encontrada");
    if (!["customers", "products"].includes(job.entity_type)) {
      throw new Error("Importação de pedidos será liberada junto com o módulo Pedidos");
    }
    const org = me.organization_id;
    await sb.from("import_jobs").update({ status: "processando", rows_total: data.rows.length, rows_imported: 0, error_log: [] }).eq("id", job.id);

    const errors: RowError[] = [];
    let imported = 0;

    try {
      if (job.entity_type === "customers") {
        const { data: sellers } = await sb.from("profiles").select("id, full_name").eq("organization_id", org);
        const byName = new Map((sellers ?? []).map((s) => [s.full_name.trim().toLowerCase(), s.id]));
        const { data: existing } = await sb.from("customers").select("id, external_id").eq("organization_id", org).not("external_id", "is", null);
        const idByExt = new Map((existing ?? []).map((c) => [c.external_id as string, c.id]));
        const inserts = [];
        for (let i = 0; i < data.rows.length; i++) {
          const r = toCustomer(data.rows[i], i + 2);
          if (isRowError(r)) { errors.push(r); continue; }
          let owner = me.id;
          if (r.seller_name) {
            const found = byName.get(r.seller_name.trim().toLowerCase());
            if (!found) { errors.push({ row: i + 2, error: `vendedor "${r.seller_name}" não encontrado` }); continue; }
            owner = found;
          }
          const { seller_name: _s, ...fields } = r;
          const record = { ...fields, organization_id: org, owner_id: owner };
          const existingId = r.external_id ? idByExt.get(r.external_id) : undefined;
          if (existingId) {
            const { error } = await sb.from("customers").update(record).eq("id", existingId);
            if (error) errors.push({ row: i + 2, error: error.message }); else imported++;
          } else inserts.push({ row: i + 2, record });
        }
        for (let i = 0; i < inserts.length; i += 500) {
          const chunk = inserts.slice(i, i + 500);
          const { error } = await sb.from("customers").insert(chunk.map((c) => c.record));
          if (error) chunk.forEach((c) => errors.push({ row: c.row, error: error.message }));
          else imported += chunk.length;
        }
      } else {
        const { data: existing } = await sb.from("products").select("id, external_id, sku").eq("organization_id", org);
        const idByExt = new Map((existing ?? []).filter((p) => p.external_id).map((p) => [p.external_id as string, p.id]));
        const idBySku = new Map((existing ?? []).map((p) => [p.sku, p.id]));
        const inserts = [];
        for (let i = 0; i < data.rows.length; i++) {
          const r = toProduct(data.rows[i], i + 2);
          if (isRowError(r)) { errors.push(r); continue; }
          const record = { ...r, organization_id: org };
          const existingId = (r.external_id && idByExt.get(r.external_id)) || idBySku.get(r.sku);
          if (existingId) {
            const { error } = await sb.from("products").update(record).eq("id", existingId);
            if (error) errors.push({ row: i + 2, error: error.message }); else imported++;
          } else inserts.push({ row: i + 2, record });
        }
        for (let i = 0; i < inserts.length; i += 500) {
          const chunk = inserts.slice(i, i + 500);
          const { error } = await sb.from("products").insert(chunk.map((c) => c.record));
          if (error) chunk.forEach((c) => errors.push({ row: c.row, error: error.message }));
          else imported += chunk.length;
        }
      }
    } catch (e) {
      errors.push({ row: 0, error: e instanceof Error ? e.message : "falha inesperada" });
    }

    const status = imported === 0 && errors.length > 0 ? "erro" : "concluido";
    await sb.from("import_jobs").update({ status, rows_imported: imported, error_log: errors.slice(0, 500) }).eq("id", job.id);
    return { status, rows_total: data.rows.length, rows_imported: imported, error_log: errors.slice(0, 500) };
  });
