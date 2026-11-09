import { expect, it, vi } from "vitest";
import { postOrderToErp } from "./erp-order";

it("reenvio usa a mesma chave de idempotência do pedido", async () => {
  const fake = vi.fn(async () => new Response(JSON.stringify({ erp_order_id: "E1" }), { status: 200 }));
  await postOrderToErp("https://erp", "t", { id: "abc" }, fake as unknown as typeof fetch);
  await postOrderToErp("https://erp", "t", { id: "abc" }, fake as unknown as typeof fetch);
  const keys = fake.mock.calls.map((c) => ((c as unknown as [string, RequestInit])[1].headers as Record<string, string>)["idempotency-key"]);
  expect(keys).toEqual(["pedido-abc", "pedido-abc"]);
});

it("resposta que não chega vira falha (tempo esgotado)", async () => {
  const hang = vi.fn((_u: string, init: RequestInit) => new Promise<Response>((_, rej) => init.signal?.addEventListener("abort", () => rej(new Error("timeout")))));
  await expect(postOrderToErp("https://erp", undefined, { id: "x" }, hang as unknown as typeof fetch, 50)).rejects.toThrow();
});
