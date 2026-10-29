import { describe, expect, it } from "vitest";
import { changeCartQuantity, type CartLine } from "@/lib/orders";
import { orderHistoryWindow } from "@/lib/order-history";

describe("quick cart updates", () => {
  const line: CartLine = { product_id: "p1", name: "Produto", quantity: 1, unit_price: 5, stock: 10, ai_suggestion_id: "suggestion" };
  it("increments repeatedly without losing AI attribution", () => {
    const twice = changeCartQuantity(changeCartQuantity([line], "p1", 1), "p1", 1);
    expect(twice[0]).toEqual({ ...line, quantity: 3 });
  });
  it("removes the last unit", () => {
    expect(changeCartQuantity([line], "p1", -1)).toEqual([]);
  });
});
describe("12-month customer history", () => {
  it("uses exactly 12 calendar months", () => {
    expect(orderHistoryWindow(new Date("2026-10-29T13:42:00Z"))).toEqual({ from: "2025-10-29T13:42:00.000Z", to: "2026-10-29T13:42:00.000Z" });
  });
  it("handles leap-year month ends", () => {
    expect(orderHistoryWindow(new Date("2024-02-29T12:00:00Z")).from).toBe("2023-02-28T12:00:00.000Z");
  });
});