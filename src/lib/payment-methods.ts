export const PAYMENT_METHODS = ["dinheiro", "cartao_credito", "cartao_debito", "boleto", "cheque", "deposito", "bonificacao", "multiplas"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  boleto: "Boleto",
  cheque: "Cheque",
  deposito: "Depósito",
  bonificacao: "Bonificação",
  multiplas: "Múltiplas",
};
