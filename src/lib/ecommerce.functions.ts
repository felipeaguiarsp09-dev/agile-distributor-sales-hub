import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** create-payment-intent: cria a cobrança do pedido do e-commerce no gateway configurado em Integrações. */
export const createPaymentIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { order_id: string }) => {
    if (!d?.order_id || typeof d.order_id !== "string") throw new Error("Pedido inválido");
    return d;
  })
  .handler(async ({ data, context }) => {
    // RLS: só quem enxerga o pedido (o próprio cliente) chega aqui com ele.
    const { data: order } = await context.supabase
      .from("orders")
      .select("id, organization_id, status, total_amount, origin")
      .eq("id", data.order_id)
      .maybeSingle();
    if (!order) throw new Error("Pedido não encontrado");
    if (order.origin !== "ecommerce") throw new Error("Pagamento online só para pedidos do e-commerce");
    if (!["aprovado", "aguardando_aprovacao"].includes(order.status)) throw new Error("Este pedido não está pronto para pagamento");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: paid } = await supabaseAdmin.from("payments").select("id").eq("order_id", order.id).eq("status", "pago").maybeSingle();
    if (paid) return { status: "pago" as const, checkout_url: null, message: "Este pedido já foi pago" };

    const { data: cfg } = await supabaseAdmin
      .from("integration_configs")
      .select("provider, credentials")
      .eq("organization_id", order.organization_id)
      .eq("integration_type", "pagamento")
      .eq("is_active", true)
      .maybeSingle();

    const amount = Number(order.total_amount);
    if (!cfg?.provider || !["mercadopago", "asaas", "stripe"].includes(cfg.provider)) {
      await supabaseAdmin.from("payments").insert({ order_id: order.id, organization_id: order.organization_id, gateway: "manual", amount, status: "pendente" });
      return { status: "pendente" as const, checkout_url: null, message: "Pagamento online ainda não configurado: a distribuidora vai combinar o pagamento com você." };
    }

    const { createIntent } = await import("./payments.server");
    const origin = new URL(getRequest().url).origin;
    const webhook = `${origin}/api/public/payment-webhook?provider=${cfg.provider}&org=${order.organization_id}`;
    try {
      const intent = await createIntent(
        cfg.provider as "mercadopago" | "asaas" | "stripe",
        (cfg.credentials ?? {}) as Record<string, string>,
        { id: order.id, amount, title: `Pedido #${order.id.slice(0, 8).toUpperCase()}` },
        webhook,
        `${origin}/ecommerce/pedidos`,
      );
      await supabaseAdmin.from("payments").insert({
        order_id: order.id, organization_id: order.organization_id, gateway: cfg.provider,
        gateway_payment_id: intent.gateway_payment_id, amount, status: "pendente",
      });
      return { status: "pendente" as const, checkout_url: intent.checkout_url, message: "Redirecionando para o pagamento" };
    } catch (e) {
      console.error("create-payment-intent", e);
      return { status: "erro" as const, checkout_url: null, message: "Não foi possível iniciar o pagamento agora. Seu pedido está salvo; tente pagar de novo em Meus pedidos." };
    }
  });
