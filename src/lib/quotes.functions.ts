import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const quoteInput = (d: { quote_id: string }) => {
  if (!d?.quote_id) throw new Error("Orçamento inválido");
  return d;
};

/** convert-quote-to-order: confere o estoque e transforma o orçamento em pedido pelo fluxo normal. */
export const convertQuoteToOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(quoteInput)
  .handler(async ({ data, context }) => {
    const { data: quote } = await context.supabase
      .from("quotes")
      .select("id, status, quote_items(product_id, quantity, products(name, stock_quantity, is_active))")
      .eq("id", data.quote_id)
      .maybeSingle();
    if (!quote) return { ok: false as const, error: "Orçamento não encontrado" };
    if (quote.status !== "aberto") return { ok: false as const, error: "Este orçamento já foi convertido ou cancelado" };
    const short = (quote.quote_items ?? []).filter((i) => !i.products?.is_active || i.quantity > (i.products.stock_quantity ?? 0));
    if (short.length) {
      return { ok: false as const, error: `Estoque insuficiente: ${short.map((i) => i.products?.name ?? "Produto").join(", ")}` };
    }
    const { data: res, error } = await context.supabase.rpc("convert_quote_to_order", { p_quote_id: data.quote_id });
    if (error) return { ok: false as const, error: error.message };
    const out = (res ?? {}) as { order_id?: string; status?: string; needs_approval?: boolean };
    return {
      ok: true as const,
      order_id: out.order_id ?? "",
      status: out.status ?? "",
      needs_approval: !!out.needs_approval,
    };
  });
