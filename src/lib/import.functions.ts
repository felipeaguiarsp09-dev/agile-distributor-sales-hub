import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseCsv } from "./csv";
import { isRowError, toCustomer, toOrderLine, toPaymentMethod, toProduct, type OrderLineRow, type RowError } from "./import-rows";

type Input = { import_job_id: string };

/** import-erp-data: lê o arquivo do import_jobs no Storage e grava clientes, produtos ou pedidos. */
export const importErpData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Input) => {
    if (!d?.import_job_id) throw new Error("Dados inválidos");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: me } = await sb.from("profiles").select("id, role, organization_id").eq("id", context.userId).single();
    if (!me || me.role !== "administrador") throw new Error("Apenas o administrador pode importar");

    const { data: job } = await sb.from("import_jobs").select("*").eq("id", data.import_job_id).single();
    if (!job || job.organization_id !== me.organization_id) throw new Error("Importação não encontrada");
    if (!["customers", "products", "orders", "payment_methods"].includes(job.entity_type)) throw new Error("Tipo de importação inválido");
    const org = me.organization_id;
    // Gravações de cadastros do ERP usam a conta de serviço: o banco bloqueia alterações locais.
    const { supabaseAdmin: erp } = await import("@/integrations/supabase/client.server");

    const errors: RowError[] = [];
    let imported = 0;
    let rowsTotal = 0;
    const setJob = (fields: { status?: string; rows_total?: number; rows_imported?: number; error_log?: RowError[] }) => sb.from("import_jobs").update(fields).eq("id", job.id);
    let lastReport = 0;
    const progress = async (force = false) => {
      if (!force && imported - lastReport < 200) return;
      lastReport = imported;
      await setJob({ rows_imported: imported });
    };

    try {
      if (!job.file_url) throw new Error("Arquivo não enviado");
      const { data: blob, error: dlErr } = await sb.storage.from("imports").download(job.file_url);
      if (dlErr || !blob) throw new Error("Não foi possível ler o arquivo enviado");
      const rows = parseCsv(await blob.text());
      if (rows.length === 0) throw new Error("O arquivo não tem linhas para importar");
      if (rows.length > 20000) throw new Error("Arquivo grande demais (máx. 20.000 linhas)");
      rowsTotal = rows.length;
      await setJob({ status: "processando", rows_total: rowsTotal, rows_imported: 0, error_log: [] });

      if (job.entity_type === "customers") {
        const { data: sellers } = await sb.from("profiles").select("id, full_name").eq("organization_id", org);
        const byName = new Map((sellers ?? []).map((s) => [s.full_name.trim().toLowerCase(), s.id]));
        const { data: existing } = await sb.from("customers").select("id, external_id").eq("organization_id", org).not("external_id", "is", null);
        const idByExt = new Map((existing ?? []).map((c) => [c.external_id as string, c.id]));
        const inserts = [];
        for (let i = 0; i < rows.length; i++) {
          const r = toCustomer(rows[i]!, i + 2);
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
            const { error } = await erp.from("customers").update(record).eq("id", existingId);
            if (error) errors.push({ row: i + 2, error: error.message }); else { imported++; await progress(); }
          } else inserts.push({ row: i + 2, record });
        }
        for (let i = 0; i < inserts.length; i += 500) {
          const chunk = inserts.slice(i, i + 500);
          const { error } = await erp.from("customers").insert(chunk.map((c) => c.record));
          if (error) chunk.forEach((c) => errors.push({ row: c.row, error: error.message }));
          else imported += chunk.length;
          await progress(true);
        }
      } else if (job.entity_type === "payment_methods") {
        // Formas de pagamento vêm do ERP: upsert pelo código, sem apagar as usadas em pedidos antigos.
        for (let i = 0; i < rows.length; i++) {
          const r = toPaymentMethod(rows[i]!, i + 2);
          if (isRowError(r)) { errors.push(r); continue; }
          const { error } = await erp.from("payment_methods").upsert({ ...r, organization_id: org, updated_at: new Date().toISOString() }, { onConflict: "organization_id,code" });
          if (error) errors.push({ row: i + 2, error: error.message }); else { imported++; await progress(); }
        }
      } else if (job.entity_type === "products") {
        const { data: existing } = await sb.from("products").select("id, external_id, sku").eq("organization_id", org);
        const idByExt = new Map((existing ?? []).filter((p) => p.external_id).map((p) => [p.external_id as string, p.id]));
        // Sem ID do ERP no produto local, o código/SKU ainda vincula (e grava o ID na primeira importação).
        const idBySku = new Map((existing ?? []).filter((p) => !p.external_id).map((p) => [p.sku, p.id]));
        const idBySkuAny = new Map((existing ?? []).map((p) => [p.sku, p.id]));
        const inserts = [];
        for (let i = 0; i < rows.length; i++) {
          const r = toProduct(rows[i]!, i + 2);
          if (isRowError(r)) { errors.push(r); continue; }
          const { external_id: extId, ...rest } = r;
          // Linha sem ID do ERP: vincula pelo código a qualquer produto (inclusive já ligado a um ID) e preserva o ID gravado.
          const record = extId ? { ...r, organization_id: org } : { ...rest, organization_id: org };
          const existingId = extId ? (idByExt.get(extId) ?? idBySku.get(r.sku)) : (idBySkuAny.get(r.sku) ?? idBySku.get(r.sku));
          if (existingId) {
            const { error } = await erp.from("products").update(record).eq("id", existingId);
            if (error) errors.push({ row: i + 2, error: error.message }); else { imported++; await progress(); }
          } else inserts.push({ row: i + 2, record });
        }
        for (let i = 0; i < inserts.length; i += 500) {
          const chunk = inserts.slice(i, i + 500);
          const { error } = await erp.from("products").insert(chunk.map((c) => c.record));
          if (error) chunk.forEach((c) => errors.push({ row: c.row, error: error.message }));
          else imported += chunk.length;
          await progress(true);
        }
      } else {
        // Pedidos históricos: o código do ERP fica em erp_order_id (de-para); reimportar não duplica.
        const [{ data: customers }, { data: products }, { data: sellers }, { data: existing }] = await Promise.all([
          sb.from("customers").select("id, external_id, owner_id").eq("organization_id", org).not("external_id", "is", null),
          sb.from("products").select("id, sku, unit_price").eq("organization_id", org),
          sb.from("profiles").select("id, full_name").eq("organization_id", org),
          sb.from("orders").select("erp_order_id").eq("organization_id", org).not("erp_order_id", "is", null),
        ]);
        const custByExt = new Map((customers ?? []).map((c) => [c.external_id as string, c]));
        const prodBySku = new Map((products ?? []).map((p) => [p.sku, p]));
        const sellerByName = new Map((sellers ?? []).map((s) => [s.full_name.trim().toLowerCase(), s.id]));
        const done = new Set((existing ?? []).map((o) => o.erp_order_id as string));

        const groups = new Map<string, { row: number; line: OrderLineRow }[]>();
        for (let i = 0; i < rows.length; i++) {
          const r = toOrderLine(rows[i]!, i + 2);
          if (isRowError(r)) { errors.push(r); continue; }
          const g = groups.get(r.order_code) ?? [];
          g.push({ row: i + 2, line: r });
          groups.set(r.order_code, g);
        }

        // Pedidos históricos já vêm fechados do ERP; gravados com acesso privilegiado só após validar o administrador.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        for (const [code, lines] of groups) {
          const fail = (msg: string) => lines.forEach((l) => errors.push({ row: l.row, error: msg }));
          if (done.has(code)) { fail(`pedido ${code} já importado`); continue; }
          const head = lines[0]!.line;
          const cust = custByExt.get(head.customer_code);
          if (!cust) { fail(`cliente "${head.customer_code}" não encontrado`); continue; }
          let seller = cust.owner_id;
          if (head.seller_name) {
            const s = sellerByName.get(head.seller_name.trim().toLowerCase());
            if (!s) { fail(`vendedor "${head.seller_name}" não encontrado`); continue; }
            seller = s;
          }
          const missing = lines.find((l) => !prodBySku.has(l.line.sku));
          if (missing) { fail(`produto "${missing.line.sku}" não encontrado`); continue; }
          const items = lines.map((l) => {
            const price = l.line.unit_price ?? prodBySku.get(l.line.sku)!.unit_price;
            return { product_id: prodBySku.get(l.line.sku)!.id, quantity: l.line.quantity, unit_price: price, line_total: Math.round(l.line.quantity * price * 100) / 100 };
          });
          const subtotal = items.reduce((s, it) => s + it.line_total, 0);
          const discount = Math.min(head.discount, subtotal);
          const { data: order, error } = await supabaseAdmin.from("orders").insert({
            organization_id: org, customer_id: cust.id, seller_id: seller, origin: "vendedor", status: head.status,
            total_amount: Math.round((subtotal - discount) * 100) / 100, discount_amount: discount, returned_amount: head.returned,
            erp_order_id: code, erp_sync_status: "sincronizado", ...(head.created_at ? { created_at: head.created_at } : {}),
          }).select("id").single();
          if (error || !order) { fail(error?.message ?? "falha ao gravar pedido"); continue; }
          const { error: itemErr } = await supabaseAdmin.from("order_items").insert(items.map((it) => ({ ...it, order_id: order.id })));
          if (itemErr) {
            await supabaseAdmin.from("orders").delete().eq("id", order.id);
            fail(itemErr.message);
            continue;
          }
          done.add(code);
          imported += lines.length;
          await progress();
        }
      }
    } catch (e) {
      errors.push({ row: 0, error: e instanceof Error ? e.message : "falha inesperada" });
    }

    const status = imported === 0 && errors.length > 0 ? "erro" : "concluido";
    await setJob({ status, rows_total: rowsTotal, rows_imported: imported, error_log: errors.slice(0, 500) });
    return { status, rows_total: rowsTotal, rows_imported: imported, error_log: errors.slice(0, 500) };
  });
