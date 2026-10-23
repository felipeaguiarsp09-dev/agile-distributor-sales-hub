import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";
import { parseMoney, toCustomer, toProduct } from "@/lib/import-rows";

describe("importação da planilha/ERP", () => {
  it("lê CSV com ponto e vírgula e cabeçalhos acentuados", () => {
    const rows = parseCsv('Nome;Limite de crédito\n"Mercado A; Filial";1.500,00\n');
    expect(rows).toEqual([{ nome: "Mercado A; Filial", limite_de_credito: "1.500,00" }]);
  });
  it("converte valores no formato brasileiro", () => {
    expect(parseMoney("1.234,56")).toBe(1234.56);
  });
  it("rejeita cnpj_cpf inválido", () => {
    expect(toCustomer({ nome: "X", cnpj: "123" }, 5)).toEqual({ row: 5, error: "cnpj_cpf inválido" });
  });
  it("rejeita situação de crédito fora de ok/restrito/bloqueado", () => {
    expect(toCustomer({ nome: "X", situacao: "suspenso" }, 2)).toEqual({ row: 2, error: "situação de crédito inválida" });
  });
  it("exige sku no produto", () => {
    expect(toProduct({ nome: "Água" }, 3)).toEqual({ row: 3, error: "sku obrigatório" });
  });
  it("produto fica fora do E-commerce por padrão", () => {
    const p = toProduct({ sku: "A1", nome: "Água", preco: "2,50" }, 2);
    expect(p).toMatchObject({ unit_price: 2.5, is_ecommerce_visible: false, is_active: true });
  });
});
