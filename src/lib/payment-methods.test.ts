import { expect, it } from "vitest";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "./payment-methods";
it("oferece as 8 formas de pagamento pedidas", () => {
  expect(PAYMENT_METHODS.map((m) => PAYMENT_METHOD_LABEL[m])).toEqual(["Dinheiro", "Cartão de crédito", "Cartão de débito", "Boleto", "Cheque", "Depósito", "Bonificação", "Múltiplas"]);
});
