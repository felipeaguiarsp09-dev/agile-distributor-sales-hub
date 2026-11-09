import { describe, expect, it } from "vitest";
import { cartTotals, escapeSearchTerm, orderNumberSearch } from "@/lib/orders";

const line = (quantity: number, unit_price: number) => ({ product_id: "p", name: "x", unit_price, stock: 99, quantity, ai_suggestion_id: null });

describe("totais do pedido", () => {
  it("soma itens e subtrai o desconto", () => {
    expect(cartTotals([line(3, 10), line(1, 5.5)], 5)).toEqual({ subtotal: 35.5, discount: 5, total: 30.5 });
  });
  it("desconto nunca passa do subtotal", () => {
    expect(cartTotals([line(1, 10)], 50).total).toBe(0);
  });
});

describe("busca de pedidos por número e nome", () => {
  it("converte o número do pedido em faixa de id, com ou sem #", () => {
    expect(orderNumberSearch("#ABC123")).toEqual({
      gte: "abc12300-0000-0000-0000-000000000000",
      lt: "abc123ff-ffff-ffff-ffff-ffffffffffff",
    });
  });
  it("termo que não é número de pedido não filtra por id", () => {
    expect(orderNumberSearch("Empório")).toBeNull();
    expect(orderNumberSearch("")).toBeNull();
  });
  it("limpa caracteres especiais do termo de busca", () => {
    expect(escapeSearchTerm('  João, (a) "x"  ')).toBe("João a x");
  });
});

describe("status e períodos de pedidos", () => {
  it("rascunho, aguardando e aprovado aparecem como Em aberto", async () => {
    const { ORDER_STATUS_LABEL, ORDER_STATUS_GROUPS } = await import("@/lib/orders");
    expect([ORDER_STATUS_LABEL["rascunho"], ORDER_STATUS_LABEL["aguardando_aprovacao"], ORDER_STATUS_LABEL["aprovado"]]).toEqual(["Em aberto", "Em aberto", "Em aberto"]);
    expect(ORDER_STATUS_GROUPS["entregue"]!.statuses).toEqual(["entregue"]);
  });
  it("atalho de 30 dias calcula a data inicial", async () => {
    const { daysAgo } = await import("@/lib/orders");
    expect(daysAgo(30, new Date(2026, 10, 9))).toBe("2026-10-10");
  });
});
