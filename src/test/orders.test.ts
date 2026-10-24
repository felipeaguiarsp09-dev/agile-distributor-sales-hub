import { describe, expect, it } from "vitest";
import { cartTotals } from "@/lib/orders";

const line = (quantity: number, unit_price: number) => ({ product_id: "p", name: "x", unit_price, stock: 99, quantity, ai_suggestion_id: null });

describe("totais do pedido", () => {
  it("soma itens e subtrai o desconto", () => {
    expect(cartTotals([line(3, 10), line(1, 5.5)], 5)).toEqual({ subtotal: 35.5, discount: 5, total: 30.5 });
  });
  it("desconto nunca passa do subtotal", () => {
    expect(cartTotals([line(1, 10)], 50).total).toBe(0);
  });
});
