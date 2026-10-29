import { describe, expect, it } from "vitest";
import { lastPurchase, purchasedProducts, type HistoryOrder, type HistoryOrderItem } from "@/lib/orders";

const item = (productId: string, name: string, unit_price = 10, quantity = 1, was_ai_suggested = false): HistoryOrderItem => ({
  product_id: productId,
  quantity,
  unit_price,
  was_ai_suggested,
  products: { name, unit_price, stock_quantity: 10 },
});

const order = (created_at: string, status: string, items: HistoryOrderItem[], discount_amount = 0): HistoryOrder => ({
  id: created_at,
  created_at,
  status,
  discount_amount,
  order_items: items,
});

describe("purchasedProducts", () => {
  it("considera apenas pedidos aprovados ou faturados", () => {
    const orders = [
      order("2026-01-01", "rascunho", [item("a", "A")]),
      order("2026-01-02", "cancelado", [item("b", "B")]),
      order("2026-01-03", "recusado", [item("c", "C")]),
      order("2026-01-04", "aguardando_aprovacao", [item("d", "D")]),
    ];
    expect(purchasedProducts(orders)).toEqual([]);
  });

  it("ordena por frequência e, empatado, pelo pedido mais recente", () => {
    const orders = [
      order("2026-03-01", "aprovado", [item("a", "A"), item("b", "B")]),
      order("2026-04-01", "faturado", [item("a", "A"), item("c", "C")]),
      order("2026-02-01", "aprovado", [item("b", "B")]),
    ];
    expect(purchasedProducts(orders).map((p) => p.product_id)).toEqual(["a", "b", "c"]);
    expect(purchasedProducts(orders)[0]?.ordersCount).toBe(2);
  });

  it("respeita o limite informado", () => {
    const orders = [order("2026-01-01", "aprovado", [item("1", "1"), item("2", "2"), item("3", "3")])];
    expect(purchasedProducts(orders, 2)).toHaveLength(2);
  });
});

describe("lastPurchase", () => {
  it("devolve as linhas do pedido aprovado mais recente, ignorando cancelados", () => {
    const orders = [
      order("2026-01-05", "faturado", [item("b", "B", 8, 3)]),
      order("2026-02-05", "aprovado", [item("a", "A", 10, 2, true)]),
      order("2026-03-05", "cancelado", [item("z", "Z")]),
    ];
    const last = lastPurchase(orders);
    expect(last?.lines).toEqual([{ product_id: "a", name: "A", unit_price: 10, stock: 10, quantity: 2, ai_suggestion_id: "ai" }]);
    expect(last?.discountAmount).toBe(0);
  });

  it("carrega o desconto do pedido repetido", () => {
    const orders = [order("2026-01-05", "aprovado", [item("a", "A")], 5)];
    expect(lastPurchase(orders)?.discountAmount).toBe(5);
  });

  it("devolve null sem pedidos comprados", () => {
    expect(lastPurchase([order("2026-01-05", "rascunho", [item("a", "A")])])).toBeNull();
    expect(lastPurchase([])).toBeNull();
  });
});
