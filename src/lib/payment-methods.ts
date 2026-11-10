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

/** Formas de pagamento cadastradas pelo ERP (importação). O mapa acima serve só de rótulo para pedidos antigos. */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
export type ErpPaymentMethod = { code: string; name: string; requires_days: boolean; is_active: boolean };
export function usePaymentMethods() {
  return useQuery({
    queryKey: ["payment-methods"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_methods").select("code, name, requires_days, is_active").order("name");
      if (error) throw error;
      return data as ErpPaymentMethod[];
    },
    staleTime: 5 * 60_000,
  });
}
export function paymentMethodLabel(code: string, list?: ErpPaymentMethod[]) {
  return list?.find((m) => m.code === code)?.name ?? PAYMENT_METHOD_LABEL[code as PaymentMethod] ?? code;
}
