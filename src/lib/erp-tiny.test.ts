import { expect, it, vi } from "vitest";
import { buildTinyOrder, parseTinyResponse, postOrderToTiny, TINY_ORDER_URL } from "./erp-tiny";

const order = {
  id: "abc",
  created_at: "2026-11-10T02:30:00Z", // 09/11 23:30 em São Paulo
  discount_amount: 5,
  payment_method: "boleto",
  payment_days: 28,
  notes: "Entregar pela manhã",
  customers: { external_id: "TESTE-1", name: "Cliente Simulado", cnpj_cpf: "12.345.678/0001-90" },
  order_items: [{ quantity: 3, unit_price: 2.5, products: { sku: "AGUA500", name: "Água 500ml" } }],
};

it("monta o pedido no formato do Tiny", () => {
  const p = buildTinyOrder(order).pedido;
  expect(p.data_pedido).toBe("09/11/2026");
  expect(p.numero_pedido_ecommerce).toBe("pedido-abc");
  expect(p.cliente).toEqual({ codigo: "TESTE-1", nome: "Cliente Simulado", cpf_cnpj: "12345678000190", atualizar_cliente: "N" });
  expect(p.itens).toEqual([{ item: { codigo: "AGUA500", descricao: "Água 500ml", unidade: "UN", quantidade: "3", valor_unitario: "2.50" } }]);
  expect(p.forma_pagamento).toBe("boleto");
  expect(p.valor_desconto).toBe("5.00");
  expect(p.obs).toBe("Entregar pela manhã · Prazo: 28 dias");
});

it("envia token e pedido para o endereço do Tiny e lê o número devolvido", async () => {
  const fake = vi.fn(async () => new Response(JSON.stringify({ retorno: { status: "OK", registros: [{ registro: { sequencia: "1", status: "OK", id: 999, numero: 1234 } }] } })));
  const r = await postOrderToTiny("tok", order, fake as unknown as typeof fetch);
  const [url, init] = fake.mock.calls[0] as unknown as [string, RequestInit];
  const body = init.body as URLSearchParams;
  expect(url).toBe(TINY_ORDER_URL);
  expect(body.get("formato")).toBe("json");
  expect(JSON.parse(body.get("pedido")!).pedido.numero_pedido_ecommerce).toBe("pedido-abc");
  expect(r).toEqual({ ok: true, erpId: "1234" });
});

it("reenvio do mesmo pedido usa a mesma chave", () => {
  expect(buildTinyOrder(order).pedido.numero_pedido_ecommerce).toBe(buildTinyOrder({ ...order }).pedido.numero_pedido_ecommerce);
});

it("pedido duplicado no Tiny é reconhecido", () => {
  const r = parseTinyResponse({ retorno: { status: "Erro", registros: [{ registro: { status: "Erro", codigo_erro: "30", erros: [{ erro: "Registro em duplicidade" }] } }] } });
  expect(r.ok).toBe(false);
  expect(r.duplicate).toBe(true);
});

it("erro do Tiny vira falha com o motivo", () => {
  const r = parseTinyResponse({ retorno: { status: "Erro", codigo_erro: "2", erros: [{ erro: "Token inválido" }] } });
  expect(r).toMatchObject({ ok: false, duplicate: false, error: "Token inválido" });
});
