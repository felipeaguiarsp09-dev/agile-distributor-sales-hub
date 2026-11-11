import { describe, it, expect } from "vitest";
import { planProductRow, toProduct, isRowError, type ExistingProduct, type ProductRow } from "@/lib/import-rows";

type Db = (ExistingProduct & Partial<ProductRow>)[];
// Simula o banco em memória aplicando o mesmo plano do importador.
function runImport(db: Db, sheet: Record<string, string>[]) {
  const errors: string[] = [];
  sheet.forEach((raw, i) => {
    const r = toProduct(raw, i + 2);
    if (isRowError(r)) return errors.push(r.error);
    const step = planProductRow(db, r, i + 2);
    if (isRowError(step)) return errors.push(step.error);
    if (step.kind === "update") Object.assign(db.find((p) => p.id === step.id)!, step.record);
    else db.push({ ...step.record, id: `new-${db.length}` });
  });
  return errors;
}
const seed = (): Db => [
  { id: "a", external_id: "111", sku: "CAFE", unit_price: 10, stock_quantity: 5, name: "Café" },
  { id: "b", external_id: "222", sku: "ACUCAR", unit_price: 4, stock_quantity: 9, name: "Açúcar" },
];
const skuSheet = [
  { sku: "CAFE", nome: "Café", preco: "12,50", estoque: "30" },
  { sku: "ACUCAR", nome: "Açúcar", preco: "4,90", estoque: "1" },
];

describe("importação de produtos só com SKU", () => {
  it("atualiza preço e estoque sem duplicar nem apagar o ID do Tiny", () => {
    const db = seed();
    expect(runImport(db, skuSheet)).toEqual([]);
    expect(db).toHaveLength(2);
    expect(db[0]).toMatchObject({ id: "a", external_id: "111", unit_price: 12.5, stock_quantity: 30 });
    expect(db[1]).toMatchObject({ id: "b", external_id: "222", unit_price: 4.9, stock_quantity: 1 });
  });
  it("reimportar a mesma planilha não cria duplicatas", () => {
    const db = seed();
    runImport(db, skuSheet); runImport(db, skuSheet);
    expect(db).toHaveLength(2);
    expect(db.map((p) => p.external_id)).toEqual(["111", "222"]);
  });
  it("SKU ambíguo é recusado e nada é alterado", () => {
    const db: Db = [...seed(), { id: "c", external_id: "333", sku: "CAFE", unit_price: 99, stock_quantity: 0, name: "Café 2" }];
    const errors = runImport(db, [skuSheet[0]!]);
    expect(errors[0]).toMatch(/SKU ambíguo/);
    expect(db).toHaveLength(3);
    expect(db.find((p) => p.id === "a")!.unit_price).toBe(10);
    expect(db.find((p) => p.id === "c")!.unit_price).toBe(99);
  });
  it("SKU novo sem ID cria um único produto", () => {
    const db = seed();
    runImport(db, [{ sku: "SAL", nome: "Sal", preco: "2", estoque: "3" }]);
    runImport(db, [{ sku: "SAL", nome: "Sal", preco: "2", estoque: "3" }]);
    expect(db.filter((p) => p.sku === "SAL")).toHaveLength(1);
  });
  it("linha com ID continua vinculando pelo ID", () => {
    const db = seed();
    runImport(db, [{ id_erp: "111", sku: "CAFE-NOVO", nome: "Café", preco: "11", estoque: "2" }]);
    expect(db).toHaveLength(2);
    expect(db[0]).toMatchObject({ id: "a", sku: "CAFE-NOVO", unit_price: 11 });
  });
});
