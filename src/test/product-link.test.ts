import { describe, it, expect } from "vitest";
import { productMatcher } from "@/lib/erp-stock.server";
import { buildTinyOrder } from "@/lib/erp-tiny";

const prods = [{ id: "a", sku: "S1", external_id: "100" }, { id: "b", sku: "S2", external_id: null }];
describe("vínculo de produto pelo ID do ERP", () => {
  const find = productMatcher(prods);
  it("estoque usa o ID mesmo com SKU diferente", () => expect(find({ id_produto: 100, sku: "OUTRO" })?.id).toBe("a"));
  it("ID desconhecido não cai no SKU", () => expect(find({ id: "999", sku: "S1" })).toBeUndefined());
  it("sem ID usa o SKU", () => expect(find({ codigo: "S2" })?.id).toBe("b"));
  it("pedido ao Tiny leva id_produto", () => {
    const o = buildTinyOrder({ id: "x", created_at: "2026-01-01T12:00:00Z", order_items: [{ quantity: 1, unit_price: 2, products: { sku: "S1", name: "P", external_id: "100" } }] });
    expect(o.pedido.itens[0]!.item).toMatchObject({ id_produto: "100", codigo: "S1" });
  });
});

describe("casos de ID ausente, desconhecido e conflitante", () => {
  const find = productMatcher(prods);
  const item = (external_id: string | null) => buildTinyOrder({ id: "x", created_at: "2026-01-01T12:00:00Z", order_items: [{ quantity: 1, unit_price: 2, products: { sku: "S2", name: "P", external_id } }] }).pedido.itens[0]!.item;
  it("ID vazio usa o código", () => expect(find({ id_produto: "", codigo: "S2" })?.id).toBe("b"));
  it("ID conflitante com o SKU: vale o ID", () => expect(find({ external_id: "100", sku: "S2" })?.id).toBe("a"));
  it("ID desconhecido sem SKU: sem cadastro", () => expect(find({ id_produto: 555 })).toBeUndefined());
  it("linha sem ID nem SKU: sem cadastro", () => expect(find({ estoque: 5 })).toBeUndefined());
  it("produto sem ID não envia id_produto", () => expect(item(null)).not.toHaveProperty("id_produto"));
  it("ID não numérico não envia id_produto", () => expect(item("ABC-1")).not.toHaveProperty("id_produto"));
  it("ID com espaços é limpo", () => expect(item(" 42 ")).toMatchObject({ id_produto: "42", codigo: "S2" }));
});
