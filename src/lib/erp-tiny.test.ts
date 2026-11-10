import { expect, it, vi } from "vitest";
import { buildTinyOrder, parseTinyResponse, postOrderToTiny, sendOrderToTiny, TINY_ORDER_URL, TINY_SEARCH_URL } from "./erp-tiny";

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

// ---- Estratégia contra duplicidade (respostas simuladas do Tiny) ----

const ok = (b: unknown) => new Response(JSON.stringify(b));
const notFound = () => ok({ retorno: { status: "Erro", codigo_erro: 20, erros: [{ erro: "A consulta não retornou registros" }] } });
const found = (numero = 77) => ok({ retorno: { status: "OK", pedidos: [{ pedido: { id: 1, numero, numero_ecommerce: "pedido-abc" } }] } });
const created = () => ok({ retorno: { status: "OK", registros: [{ registro: { status: "OK", id: 9, numero: 1234 } }] } });
const dup = () => ok({ retorno: { status: "Erro", codigo_erro: 30, registros: [{ registro: { status: "Erro", codigo_erro: "30", erros: [{ erro: "Pedido com número pedido-abc já existe" }] } }] } });
const script = (...rs: Array<() => Response | Promise<Response>>) => {
  const f = vi.fn(async () => rs.shift()!());
  return f as unknown as typeof fetch & typeof f;
};
const urls = (f: ReturnType<typeof vi.fn>) => f.mock.calls.map((c) => (c as unknown as [string])[0]);

it("pedido já existente no Tiny não é enviado de novo", async () => {
  const f = script(() => found(77));
  expect(await sendOrderToTiny("t", order, f)).toEqual({ status: "ja_existia", erpId: "77" });
  expect(urls(f)).toEqual([TINY_SEARCH_URL]);
});

it("consulta prévia sem resposta clara bloqueia o envio", async () => {
  const f = script(() => ok({ retorno: { status: "Erro", codigo_erro: 6 } }));
  expect((await sendOrderToTiny("t", order, f)).status).toBe("erro");
  expect(urls(f)).toEqual([TINY_SEARCH_URL]);
});

it("pedido novo é enviado uma vez e recebe o número do Tiny", async () => {
  const f = script(notFound, created);
  expect(await sendOrderToTiny("t", order, f)).toEqual({ status: "enviado", erpId: "1234" });
  expect(urls(f)).toEqual([TINY_SEARCH_URL, TINY_ORDER_URL]);
});

it("tempo esgotado no envio: confere e aceita se o Tiny gravou", async () => {
  const f = script(notFound, () => { throw new Error("timeout"); }, () => found(88));
  expect(await sendOrderToTiny("t", order, f)).toEqual({ status: "ja_existia", erpId: "88" });
});

it("tempo esgotado e pedido não encontrado vira erro para tentar depois", async () => {
  const f = script(notFound, () => { throw new Error("timeout"); }, notFound);
  expect((await sendOrderToTiny("t", order, f)).status).toBe("erro");
});

it("resposta ilegível no envio é conferida antes de decidir", async () => {
  const f = script(notFound, () => new Response("<html>502</html>"), () => found(90));
  expect(await sendOrderToTiny("t", order, f)).toEqual({ status: "ja_existia", erpId: "90" });
});

it("duplicidade só conta como enviado se o pedido for encontrado", async () => {
  expect(await sendOrderToTiny("t", order, script(notFound, dup, () => found(5)))).toEqual({ status: "ja_existia", erpId: "5" });
  expect((await sendOrderToTiny("t", order, script(notFound, dup, notFound))).status).toBe("erro");
});

it("Tiny aceitando reenvio sem recusar: a consulta prévia impede o segundo pedido", async () => {
  const f = script(notFound, created, () => found(1234));
  await sendOrderToTiny("t", order, f);
  await sendOrderToTiny("t", order, f);
  expect(urls(f).filter((u) => u === TINY_ORDER_URL)).toHaveLength(1);
});

it("erro de validação não é tratado como enviado e não reconsulta", async () => {
  const f = script(notFound, () => ok({ retorno: { status: "Erro", codigo_erro: 31, registros: [{ registro: { status: "Erro", erros: [{ erro: "Produto não encontrado" }] } }] } }));
  expect(await sendOrderToTiny("t", order, f)).toMatchObject({ status: "erro", error: "Produto não encontrado" });
  expect(f.mock.calls).toHaveLength(2);
});

it("resultado de outra referência na consulta não é aceito", async () => {
  const f = script(() => ok({ retorno: { status: "OK", pedidos: [{ pedido: { numero: 1, numero_ecommerce: "pedido-outro" } }] } }), created);
  expect(await sendOrderToTiny("t", order, f)).toEqual({ status: "enviado", erpId: "1234" });
});

it("forma de pagamento: código do Tiny e nome em meio_pagamento", () => {
  const p = buildTinyOrder({ ...order, payment_method: "cartao_credito", payment_method_name: "Cartão de crédito" }).pedido;
  expect(p.forma_pagamento).toBe("credito");
  expect(p.meio_pagamento).toBe("Cartão de crédito");
  const desconhecida = buildTinyOrder({ ...order, payment_method: "pix_loja", payment_method_name: "Pix da loja" }).pedido;
  expect(desconhecida.forma_pagamento).toBeUndefined();
  expect(desconhecida.meio_pagamento).toBe("Pix da loja");
  expect(desconhecida.obs).toContain("Forma de pagamento: pix_loja");
});

it("nome do cliente respeita o limite de 30 caracteres do Tiny", () => {
  const p = buildTinyOrder({ ...order, customers: { name: "Distribuidora de Bebidas Muito Comprida Ltda" } }).pedido;
  expect(p.cliente.nome).toHaveLength(30);
});
