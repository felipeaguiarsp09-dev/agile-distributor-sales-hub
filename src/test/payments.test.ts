import { afterEach, describe, expect, it, vi } from "vitest";
import { nextOrderStatus, verifyEvent } from "@/lib/payments.server";

afterEach(() => vi.unstubAllGlobals());

describe("payment-webhook", () => {
  it("pagamento confirmado leva pedido aprovado a faturado", () => {
    expect(nextOrderStatus("aprovado", "pago")).toBe("faturado");
  });
  it("pedido aguardando aprovação não avança com o pagamento", () => {
    expect(nextOrderStatus("aguardando_aprovacao", "pago")).toBe("aguardando_aprovacao");
  });
  it("Mercado Pago: confirma o status consultando o gateway, não o corpo recebido", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "approved", external_reference: "ord-1" }))));
    const ev = await verifyEvent("mercadopago", { access_token: "t" }, { type: "payment", data: { id: "99" } }, new Headers());
    expect(ev).toEqual({ match: { order_id: "ord-1" }, status: "pago" });
  });
  it("Asaas: rejeita aviso sem o token do webhook", async () => {
    const ev = await verifyEvent("asaas", { webhook_token: "segredo" }, { event: "PAYMENT_RECEIVED", payment: { paymentLink: "x" } }, new Headers({ "asaas-access-token": "errado" }));
    expect(ev).toBeNull();
  });
  it("Stripe: sessão expirada vira pagamento falhou", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ payment_status: "unpaid", status: "expired", client_reference_id: "o" }))));
    const ev = await verifyEvent("stripe", { secret_key: "sk" }, { data: { object: { id: "cs_1" } } }, new Headers());
    expect(ev?.status).toBe("falhou");
  });
});

import { verifySignature } from "@/lib/payments.server";
describe("assinatura do webhook", () => {
  it("recusa Stripe e Mercado Pago sem assinatura ou segredo", async () => {
    expect(await verifySignature("stripe", { secret_key: "sk" }, {}, "{}", new Headers())).toBe(false);
    expect(await verifySignature("stripe", { webhook_secret: "w" }, {}, "{}", new Headers({ "stripe-signature": "t=1,v1=abc" }))).toBe(false);
    expect(await verifySignature("mercadopago", { webhook_secret: "w" }, { data: { id: "1" } }, "{}", new Headers({ "x-signature": "ts=1,v1=x", "x-request-id": "r" }))).toBe(false);
  });
  it("aceita assinatura Stripe válida", async () => {
    const t = Math.floor(Date.now() / 1000); const raw = '{"a":1}';
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("w"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`)))].map((b) => b.toString(16).padStart(2, "0")).join("");
    expect(await verifySignature("stripe", { webhook_secret: "w" }, {}, raw, new Headers({ "stripe-signature": `t=${t},v1=${sig}` }))).toBe(true);
  });
});
