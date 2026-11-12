/** Chamadas aos gateways de pagamento (Mercado Pago, Asaas, Stripe). Somente servidor. */
export type PaymentCreds = { access_token?: string; api_key?: string; secret_key?: string; sandbox?: boolean; webhook_token?: string; webhook_secret?: string };
export type Provider = "mercadopago" | "asaas" | "stripe";

export type Intent = { gateway_payment_id: string; checkout_url: string };

const asaasBase = (c: PaymentCreds) => (c.sandbox ? "https://api-sandbox.asaas.com" : "https://api.asaas.com");

async function check(res: Response, label: string) {
  if (!res.ok) {
    console.error(`${label} ${res.status}`, await res.text().catch(() => ""));
    throw new Error(`O gateway de pagamento recusou a cobrança (${res.status})`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

export async function createIntent(
  provider: Provider,
  creds: PaymentCreds,
  order: { id: string; amount: number; title: string },
  webhookUrl: string,
  returnUrl: string,
): Promise<Intent> {
  if (provider === "mercadopago") {
    if (!creds.access_token) throw new Error("Mercado Pago sem access token");
    const body = await check(
      await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: { authorization: `Bearer ${creds.access_token}`, "content-type": "application/json" },
        body: JSON.stringify({
          items: [{ title: order.title, quantity: 1, unit_price: order.amount, currency_id: "BRL" }],
          external_reference: order.id,
          notification_url: webhookUrl,
          back_urls: { success: returnUrl, failure: returnUrl, pending: returnUrl },
          auto_return: "approved",
        }),
      }),
      "mercadopago",
    );
    return { gateway_payment_id: String(body["id"]), checkout_url: String(creds.sandbox ? body["sandbox_init_point"] : body["init_point"]) };
  }
  if (provider === "asaas") {
    if (!creds.api_key) throw new Error("Asaas sem chave de API");
    const body = await check(
      await fetch(`${asaasBase(creds)}/v3/paymentLinks`, {
        method: "POST",
        headers: { access_token: creds.api_key, "content-type": "application/json" },
        body: JSON.stringify({ name: order.title, billingType: "UNDEFINED", chargeType: "DETACHED", value: order.amount, dueDateLimitDays: 3, callback: { successUrl: returnUrl, autoRedirect: true } }),
      }),
      "asaas",
    );
    return { gateway_payment_id: String(body["id"]), checkout_url: String(body["url"]) };
  }
  if (!creds.secret_key) throw new Error("Stripe sem chave secreta");
  const form = new URLSearchParams({
    mode: "payment",
    success_url: returnUrl,
    cancel_url: returnUrl,
    client_reference_id: order.id,
    "metadata[order_id]": order.id,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "brl",
    "line_items[0][price_data][unit_amount]": String(Math.round(order.amount * 100)),
    "line_items[0][price_data][product_data][name]": order.title,
  });
  const body = await check(
    await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { authorization: `Bearer ${creds.secret_key}`, "content-type": "application/x-www-form-urlencoded" },
      body: form,
    }),
    "stripe",
  );
  return { gateway_payment_id: String(body["id"]), checkout_url: String(body["url"]) };
}

export type VerifiedEvent = { match: { order_id?: string | undefined; gateway_payment_id?: string | undefined }; status: "pendente" | "pago" | "falhou" | "estornado" };

async function hmacHex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function sigParts(h: string | null) {
  const out: Record<string, string[]> = {};
  for (const part of (h ?? "").split(",")) { const [k, v] = part.trim().split("="); if (k && v) (out[k] ??= []).push(v); }
  return out;
}
const FRESH_SECONDS = 300;
/** Assinatura do gateway: só eventos assinados com o segredo do webhook disparam consultas. */
export async function verifySignature(provider: Provider, creds: PaymentCreds, // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any, rawBody: string, headers: Headers, now = Date.now()): Promise<boolean> {
  if (provider === "asaas") return true;
  if (!creds.webhook_secret) return false;
  if (provider === "stripe") {
    const parts = sigParts(headers.get("stripe-signature"));
    const t = parts["t"]?.[0];
    if (!t || Math.abs(now / 1000 - Number(t)) > FRESH_SECONDS) return false;
    const expected = await hmacHex(creds.webhook_secret, `${t}.${rawBody}`);
    return (parts["v1"] ?? []).includes(expected);
  }
  const parts = sigParts(headers.get("x-signature"));
  const ts = parts["ts"]?.[0]; const v1 = parts["v1"]?.[0];
  const id = body?.data?.id ?? body?.id;
  const reqId = headers.get("x-request-id");
  if (!ts || !v1 || !id || !reqId) return false;
  const tsSec = Number(ts) > 1e11 ? Number(ts) / 1000 : Number(ts);
  if (Math.abs(now / 1000 - tsSec) > FRESH_SECONDS) return false;
  const rid = String(id); const idPart = /^[a-z0-9]+$/i.test(rid) ? rid.toLowerCase() : rid;
  return (await hmacHex(creds.webhook_secret, `id:${idPart};request-id:${reqId};ts:${ts};`)) === v1;
}

/** Confirma o evento consultando o próprio gateway (não confia no corpo recebido). */
export async function verifyEvent(provider: Provider, creds: PaymentCreds, // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any, headers: Headers): Promise<VerifiedEvent | null> {
  if (provider === "mercadopago") {
    const id = body?.data?.id ?? (body?.type === "payment" ? body?.id : null);
    if (!id || !creds.access_token) return null;
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(id))}`, { headers: { authorization: `Bearer ${creds.access_token}` } });
    if (!res.ok) return null;
    const p = (await res.json()) as { status: string; external_reference?: string };
    const map: Record<string, VerifiedEvent["status"]> = { approved: "pago", rejected: "falhou", cancelled: "falhou", refunded: "estornado", charged_back: "estornado" };
    return { match: { order_id: p.external_reference }, status: map[p.status] ?? "pendente" };
  }
  if (provider === "asaas") {
    if (!creds.webhook_token || headers.get("asaas-access-token") !== creds.webhook_token) return null;
    const link = body?.payment?.paymentLink;
    if (!link) return null;
    const ev = String(body?.event ?? "");
    const status: VerifiedEvent["status"] = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"].includes(ev) ? "pago" : ev === "PAYMENT_REFUNDED" ? "estornado" : ["PAYMENT_OVERDUE", "PAYMENT_DELETED"].includes(ev) ? "falhou" : "pendente";
    return { match: { gateway_payment_id: String(link) }, status };
  }
  const sessionId = body?.data?.object?.id;
  if (!sessionId || !creds.secret_key || !String(sessionId).startsWith("cs_")) return null;
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, { headers: { authorization: `Bearer ${creds.secret_key}` } });
  if (!res.ok) return null;
  const s = (await res.json()) as { payment_status: string; status: string; client_reference_id?: string };
  const status: VerifiedEvent["status"] = s.payment_status === "paid" ? "pago" : s.status === "expired" ? "falhou" : "pendente";
  return { match: { gateway_payment_id: String(sessionId), order_id: s.client_reference_id }, status };
}

/** Pagamento confirmado avança o pedido: aprovado → faturado (aguardando aprovação segue com o supervisor). */
export function nextOrderStatus(orderStatus: string, paymentStatus: VerifiedEvent["status"]) {
  return paymentStatus === "pago" && orderStatus === "aprovado" ? "faturado" : orderStatus;
}
