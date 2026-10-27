import { createFileRoute } from "@tanstack/react-router";

const PROVIDERS = ["mercadopago", "asaas", "stripe"] as const;
const UUID = /^[0-9a-f-]{36}$/i;

/** payment-webhook: recebe avisos do gateway, confirma no próprio gateway e atualiza pagamento e pedido. */
export const Route = createFileRoute("/api/public/payment-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const provider = url.searchParams.get("provider") as (typeof PROVIDERS)[number] | null;
        const org = url.searchParams.get("org") ?? "";
        if (!provider || !PROVIDERS.includes(provider) || !UUID.test(org)) return new Response("bad request", { status: 400 });
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body) return new Response("bad request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { verifyEvent, nextOrderStatus } = await import("@/lib/payments.server");
        const { data: cfg } = await supabaseAdmin
          .from("integration_configs").select("credentials")
          .eq("organization_id", org).eq("integration_type", "pagamento").eq("provider", provider).maybeSingle();
        if (!cfg) return new Response("not configured", { status: 404 });

        const ev = await verifyEvent(provider, (cfg.credentials ?? {}) as Record<string, string>, body, request.headers);
        if (!ev) return new Response("ignored", { status: 200 });

        let q = supabaseAdmin.from("payments").select("id, order_id, status").eq("organization_id", org).eq("gateway", provider);
        if (ev.match.gateway_payment_id) q = q.eq("gateway_payment_id", ev.match.gateway_payment_id);
        else if (ev.match.order_id && UUID.test(ev.match.order_id)) q = q.eq("order_id", ev.match.order_id);
        else return new Response("ignored", { status: 200 });
        const { data: pay } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (!pay) return new Response("unknown payment", { status: 200 });

        if (pay.status !== ev.status) {
          await supabaseAdmin.from("payments").update({ status: ev.status }).eq("id", pay.id);
          const { data: order } = await supabaseAdmin.from("orders").select("status").eq("id", pay.order_id).single();
          if (order) {
            const next = nextOrderStatus(order.status, ev.status);
            if (next !== order.status) await supabaseAdmin.from("orders").update({ status: next }).eq("id", pay.order_id);
          }
        }
        return Response.json({ ok: true });
      },
    },
  },
});
