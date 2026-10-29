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

export type HistoryOrderItem = { product_id: string; quantity: number; unit_price: number; was_ai_suggested: boolean; products: { name: string; unit_price: number; stock_quantity: number } | null };
export type HistoryOrder = { id: string; created_at: string; status: string; discount_amount: number; order_items: HistoryOrderItem[] };
export type PurchaseLine = { product_id: string; name: string; unit_price: number; stock_quantity: number; ordersCount: number };

const PURCHASED_STATUSES = ["aprovado", "faturado"];

export function completedPurchases(orders: HistoryOrder[]) {
  return orders.filter((o) => PURCHASED_STATUSES.includes(o.status));
}

/** Produtos que o cliente mais compra: ordena por frequência de pedidos e, empatado, pelo mais recente. */
export function purchasedProducts(orders: HistoryOrder[], limit = 8): PurchaseLine[] {
  const map = new Map<string, { line: PurchaseLine; lastOrderedAt: string }>();
  for (const order of completedPurchases(orders)) {
    for (const item of order.order_items) {
      const found = map.get(item.product_id);
      if (found) {
        found.line.ordersCount += 1;
        if (order.created_at > found.lastOrderedAt) found.lastOrderedAt = order.created_at;
      } else {
        map.set(item.product_id, {
          line: { product_id: item.product_id, name: item.products?.name ?? "", unit_price: Number(item.products?.unit_price ?? item.unit_price), stock_quantity: item.products?.stock_quantity ?? 0, ordersCount: 1 },
          lastOrderedAt: order.created_at,
        });
      }
    }
  }
  return [...map.values()]
    .sort((a, b) => b.line.ordersCount - a.line.ordersCount || (a.lastOrderedAt < b.lastOrderedAt ? 1 : a.lastOrderedAt > b.lastOrderedAt ? -1 : 0))
    .slice(0, limit)
    .map((entry) => entry.line);
}

/** Linhas do último pedido aprovado/faturado do cliente, prontas para o carrinho. */
export function lastPurchase(orders: HistoryOrder[]): { lines: CartLine[]; discountAmount: number } | null {
  const last = completedPurchases(orders).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  if (!last || last.order_items.length === 0) return null;
  const lines: CartLine[] = last.order_items.map((item) => ({
    product_id: item.product_id,
    name: item.products?.name ?? "",
    unit_price: Number(item.products?.unit_price ?? item.unit_price),
    stock: item.products?.stock_quantity ?? 0,
    quantity: item.quantity,
    ai_suggestion_id: item.was_ai_suggested ? "ai" : null,
  }));
  return { lines, discountAmount: Number(last.discount_amount) };
}
