import { describe, expect, it } from "vitest";
import { matchesCustomerSearch } from "@/lib/orders";

const customer = { name: "Empório Teste Vendedor", cnpj_cpf: "12.345.678/0001-90", external_id: "C-VEND" };

describe("busca de cliente da carteira", () => {
  it("encontra por CNPJ sem pontuação quando o cadastro tem pontuação", () => {
    expect(matchesCustomerSearch(customer, "12345678000190")).toBe(true);
  });
  it("encontra por CNPJ com pontuação quando o cadastro não tem pontuação", () => {
    expect(matchesCustomerSearch({ ...customer, cnpj_cpf: "12345678000190" }, "12.345.678/0001-90")).toBe(true);
  });
  it("encontra por trecho do CPF", () => {
    expect(matchesCustomerSearch({ name: "Maria", cnpj_cpf: "529.982.247-25" }, "529982")).toBe(true);
  });
  it("encontra por nome e por código", () => {
    expect(matchesCustomerSearch(customer, "empório")).toBe(true);
    expect(matchesCustomerSearch(customer, "c-vend")).toBe(true);
  });
  it("encontra por nome com ou sem acentos", () => {
    expect(matchesCustomerSearch(customer, "emporio")).toBe(true);
    expect(matchesCustomerSearch({ name: "Padaria São Jorge" }, "sao jorge")).toBe(true);
    expect(matchesCustomerSearch({ name: "Padaria Sao Jorge" }, "são")).toBe(true);
  });
  it("não encontra quando nada combina", () => {
    expect(matchesCustomerSearch(customer, "padaria")).toBe(false);
    expect(matchesCustomerSearch(customer, "99999999")).toBe(false);
  });
  it("busca vazia lista todos", () => {
    expect(matchesCustomerSearch(customer, "  ")).toBe(true);
  });
});
