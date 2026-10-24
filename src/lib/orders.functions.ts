import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orderInput = (d: { order_id: string }) => {
  if (!d?.order_id) throw new Error("Pedido inválido");
  return d;
};

/** validate-order-stock: confere o estoque (espelho do ERP) de cada item do rascunho. */
export const validateOrderStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(orderInput)
  .handler(async ({ data, context }) => {
    const { data: order } = await context.supabase.from("orders").select("id, status").eq("id", data.order_id).maybeSingle();
    if (!order) throw new Error("Pedido não encontrado");
    if (order.status !== "rascunho") throw new Error("Apenas pedidos em rascunho são validados");
    const { data: items, error } = await context.supabase
      .from("order_items")
      .select("product_id, quantity, products(name, stock_quantity, is_active)")
      .eq("order_id", data.order_id);
    if (error) throw new Error("Falha ao ler os itens");
    const unavailable_items = (items ?? [])
      .filter((i) => !i.products || !i.products.is_active || i.quantity > i.products.stock_quantity)
      .map((i) => ({
        product_id: i.product_id,
        name: i.products?.name ?? "Produto",
        requested: i.quantity,
        available: i.products?.is_active ? i.products.stock_quantity : 0,
      }));
    return { ok: unavailable_items.length === 0, unavailable_items };
  });

/** submit-order: valida estoque, recalcula totais e decide se precisa de aprovação. */
export const submitOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(orderInput)
  .handler(async ({ data, context }) => {
    const { data: items } = await context.supabase
      .from("order_items")
      .select("quantity, products(name, stock_quantity, is_active)")
      .eq("order_id", data.order_id);
    const short = (items ?? []).filter((i) => !i.products?.is_active || i.quantity > (i.products?.stock_quantity ?? 0));
    if (short.length) {
      return { ok: false as const, error: `Estoque insuficiente: ${short.map((i) => i.products?.name).join(", ")}` };
    }
    const { data: res, error } = await context.supabase.rpc("submit_order", { p_order_id: data.order_id });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, ...(res as { order_id: string; status: string; needs_approval: boolean; total_amount: number }) };
  });

const suggestionSchema = z.object({
  suggestions: z.array(z.object({ product_id: z.string(), reason: z.string(), score: z.number() })),
});

/** suggest-products: sugestões de upsell/cross-sell pela IA. Nunca inclui itens no pedido. */
export const suggestProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { customer_id: string; current_item_ids: string[] }) => {
    if (!d?.customer_id || !Array.isArray(d.current_item_ids)) throw new Error("Dados inválidos");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: customer } = await sb.from("customers").select("id, name, organization_id").eq("id", data.customer_id).maybeSingle();
    if (!customer) throw new Error("Cliente não encontrado");

    const { data: orders } = await sb
      .from("orders")
      .select("created_at, order_items(quantity, product_id, products(name))")
      .eq("customer_id", customer.id)
      .in("status", ["aprovado", "faturado"])
      .order("created_at", { ascending: false })
      .limit(30);
    const { data: catalog } = await sb
      .from("products")
      .select("id, name, category, unit_price, stock_quantity")
      .eq("is_active", true)
      .gt("stock_quantity", 0)
      .limit(300);
    const available = (catalog ?? []).filter((p) => !data.current_item_ids.includes(p.id));
    if (available.length === 0) return { suggestions: [] };

    const history = (orders ?? []).map((o) => ({
      data: o.created_at.slice(0, 10),
      itens: o.order_items.map((i) => `${i.products?.name} x${i.quantity}`),
    }));
    const inCart = (catalog ?? []).filter((p) => data.current_item_ids.includes(p.id)).map((p) => p.name);

    let out: z.infer<typeof suggestionSchema>;
    try {
      out = await suggestionSchema.parseAsync(
        await (await import("./ai.server")).generateStructured(
          suggestionSchema,
          "Você é um assistente comercial de uma distribuidora. Sugira até 4 produtos do catálogo disponível para upsell ou cross-sell, com base no histórico de compras do cliente e no carrinho atual. Use somente IDs do catálogo informado. A justificativa (reason) deve ter uma frase curta em português. score vai de 0 a 1.",
          JSON.stringify({ cliente: customer.name, historico: history, carrinho: inCart, catalogo: available.map((p) => ({ id: p.id, nome: p.name, categoria: p.category, preco: p.unit_price })) }),
        ),
      );
    } catch (e) {
      console.error("suggest-products", e);
      throw new Error("Não foi possível gerar sugestões agora");
    }
    const valid = new Map(available.map((p) => [p.id, p]));
    const picks = out.suggestions.filter((s) => valid.has(s.product_id)).slice(0, 4);
    if (picks.length === 0) return { suggestions: [] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("ai_suggestions")
      .insert(
        picks.map((s) => ({
          organization_id: customer.organization_id,
          customer_id: customer.id,
          suggested_product_id: s.product_id,
          reason: s.reason,
          score: Math.min(1, Math.max(0, s.score)),
        })),
      )
      .select("id, suggested_product_id, reason, score");
    if (error) console.error("ai_suggestions insert", error);
    return {
      suggestions: (rows ?? picks.map((s) => ({ id: null, suggested_product_id: s.product_id, reason: s.reason, score: s.score }))).map((r) => ({
        id: r.id as string | null,
        product: valid.get(r.suggested_product_id)!,
        reason: r.reason ?? "",
        score: Number(r.score ?? 0),
      })),
    };
  });

/** push-order-to-erp: envia pedido aprovado/faturado ao ERP configurado em Integrações. */
export const pushOrderToErp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(orderInput)
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: me } = await sb.from("profiles").select("role").eq("id", context.userId).single();
    if (!me || !["supervisor", "administrador"].includes(me.role)) throw new Error("Sem permissão");
    const { data: order } = await sb.from("orders").select("*, order_items(*), customers(external_id, name, cnpj_cpf)").eq("id", data.order_id).maybeSingle();
    if (!order) throw new Error("Pedido não encontrado");
    if (!["aprovado", "faturado"].includes(order.status)) return { ok: false, message: "Só pedidos aprovados ou faturados vão ao ERP" };
    if (order.erp_order_id) return { ok: true, message: "Pedido já enviado ao ERP", erp_order_id: order.erp_order_id };

    const { data: cfg } = await sb.from("integration_configs").select("credentials").eq("integration_type", "erp").eq("is_active", true).maybeSingle();
    const endpoint = (cfg?.credentials as { endpoint_url?: string } | null)?.endpoint_url;
    if (!endpoint) return { ok: false, message: "Integração com o ERP ainda não configurada" };

    let status: "sincronizado" | "erro" = "erro";
    let erpId: string | null = null;
    try {
      const token = process.env["ERP_API_KEY"];
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(order),
      });
      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as { erp_order_id?: string; id?: string };
        erpId = body.erp_order_id ?? body.id ?? null;
        status = "sincronizado";
      }
    } catch (e) {
      console.error("push-order-to-erp", e);
    }
    await sb.rpc("set_order_erp_result", { p_order_id: order.id, p_status: status, p_erp_order_id: erpId as string });
    return { ok: status === "sincronizado", message: status === "sincronizado" ? "Pedido enviado ao ERP" : "Falha ao enviar ao ERP", erp_order_id: erpId };
  });
