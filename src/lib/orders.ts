export const ORDER_STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovado: "Aprovado",
  recusado: "Recusado",
  faturado: "Faturado",
  cancelado: "Cancelado",
};

export const ERP_STATUS_LABEL: Record<string, string> = {
  pendente: "ERP pendente",
  sincronizado: "No ERP",
  erro: "Erro no ERP",
};

export const ORIGIN_LABEL: Record<string, string> = { vendedor: "Vendedor", ecommerce: "E-commerce" };

export const orderNumber = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;

export type CartLine = { product_id: string; name: string; unit_price: number; stock: number; quantity: number; ai_suggestion_id: string | null };

export function changeCartQuantity(lines: CartLine[], id: string, delta: number) {
  return lines.flatMap((line) => {
    if (line.product_id !== id) return [line];
    const quantity = line.quantity + delta;
    return quantity <= 0 ? [] : [{ ...line, quantity }];
  });
}

export function cartTotals(lines: CartLine[], discount: number) {
  const subtotal = Math.round(lines.reduce((s, l) => s + l.quantity * l.unit_price, 0) * 100) / 100;
  const d = Math.min(Math.max(discount || 0, 0), subtotal);
  return { subtotal, discount: d, total: Math.round((subtotal - d) * 100) / 100 };
}

/** Pelas regras de acesso do banco, só vendedor e administrador criam pedidos internos. */
export function canCreateOrder(role: string | undefined) {
  return role === "vendedor" || role === "administrador";
}
