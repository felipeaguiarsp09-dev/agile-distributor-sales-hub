import { describe, expect, it } from "vitest";
import {
  matchesPaymentMethodSearch,
  paymentMethodSummary,
  visiblePaymentMethods,
  type ErpPaymentMethod,
} from "@/lib/payment-methods";

const ERP: ErpPaymentMethod[] = [
  { code: "boleto", name: "Boleto", requires_days: true, is_active: true },
  { code: "bonificacao", name: "Bonificação", requires_days: false, is_active: true },
  { code: "cartao_credito", name: "Cartão de crédito", requires_days: false, is_active: true },
  { code: "cartao_debito", name: "Cartão de débito", requires_days: false, is_active: true },
  { code: "cheque", name: "Cheque", requires_days: false, is_active: true },
  { code: "deposito", name: "Depósito", requires_days: false, is_active: true },
  { code: "dinheiro", name: "Dinheiro", requires_days: false, is_active: true },
  { code: "multiplas", name: "Múltiplas", requires_days: false, is_active: true },
  { code: "pix", name: "Pix", requires_days: false, is_active: false },
];

const names = (list: ErpPaymentMethod[]) => list.map((m) => m.name);

describe("lista de formas de pagamento do pedido", () => {
  it("mostra as 8 formas ativas do ERP e esconde a inativa", () => {
    expect(names(visiblePaymentMethods(ERP))).toEqual([
      "Boleto",
      "Bonificação",
      "Cartão de crédito",
      "Cartão de débito",
      "Cheque",
      "Depósito",
      "Dinheiro",
      "Múltiplas",
    ]);
  });

  it("mantém a forma já salva no pedido mesmo se o ERP a desativou", () => {
    expect(names(visiblePaymentMethods(ERP, "pix"))).toContain("Pix");
  });

  it("lista vazia do ERP não quebra a tela", () => {
    expect(visiblePaymentMethods(undefined)).toEqual([]);
    expect(visiblePaymentMethods([], "boleto")).toEqual([]);
  });

  it("busca por nome com ou sem acentos", () => {
    expect(names(ERP.filter((m) => matchesPaymentMethodSearch(m, "credito")))).toEqual(["Cartão de crédito"]);
    expect(names(ERP.filter((m) => matchesPaymentMethodSearch(m, "BONIFICACAO")))).toEqual(["Bonificação"]);
    expect(names(ERP.filter((m) => matchesPaymentMethodSearch(m, "cartao")))).toEqual(["Cartão de crédito", "Cartão de débito"]);
  });

  it("busca pelo código do ERP", () => {
    expect(names(ERP.filter((m) => matchesPaymentMethodSearch(m, "debito")))).toEqual(["Cartão de débito"]);
  });

  it("busca vazia mostra tudo e termo sem correspondência não mostra nada", () => {
    expect(ERP.filter((m) => matchesPaymentMethodSearch(m, "   "))).toHaveLength(9);
    expect(ERP.filter((m) => matchesPaymentMethodSearch(m, "transferencia"))).toEqual([]);
  });

  it("só boleto exige prazo em dias", () => {
    expect(ERP.filter((m) => m.requires_days).map((m) => m.code)).toEqual(["boleto"]);
  });
});

describe("resumo da forma escolhida (lista fechada)", () => {
  it("mostra o nome da forma ativa escolhida e o aviso de prazo", () => {
    expect(paymentMethodSummary("boleto", ERP)).toEqual({ name: "Boleto", requiresDays: true });
    expect(paymentMethodSummary("dinheiro", ERP)).toEqual({ name: "Dinheiro", requiresDays: false });
  });

  it("mostra a forma desativada que já está salva no pedido", () => {
    expect(paymentMethodSummary("pix", visiblePaymentMethods(ERP, "pix"))).toEqual({ name: "Pix", requiresDays: false });
  });

  it("usa o rótulo antigo quando o ERP não tem a forma gravada no pedido", () => {
    expect(paymentMethodSummary("cartao_credito", [])).toEqual({ name: "Cartão de crédito", requiresDays: false });
    expect(paymentMethodSummary("codigo_desconhecido", [])).toEqual({ name: "codigo_desconhecido", requiresDays: false });
  });

  it("sem forma escolhida não há resumo", () => {
    expect(paymentMethodSummary("", ERP)).toBeUndefined();
  });
});
