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

/** Remove acentos/diacríticos para comparação (ex.: "Empório" -> "emporio"). */
export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Busca de cliente da carteira por nome (com ou sem acentos), código ERP ou CNPJ/CPF (com ou sem pontuação). */
export function matchesCustomerSearch(
  c: { name: string; cnpj_cpf?: string | null; external_id?: string | null },
  query: string,
): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  const plainTerm = stripDiacritics(term);
  const doc = (c.cnpj_cpf ?? "").toLowerCase();
  const digits = term.replace(/\D/g, "");
  const docDigits = doc.replace(/\D/g, "");
  return (
    stripDiacritics(c.name.toLowerCase()).includes(plainTerm) ||
    (c.external_id ?? "").toLowerCase().includes(term) ||
    doc.includes(term) ||
    (digits.length >= 3 && docDigits.includes(digits))
  );
}

/** Prefixo do número do pedido (8 primeiros caracteres do id, exibidos em maiúsculas). */
export function orderNumberSearch(term: string): { gte: string; lt: string } | null {
  const digits = term.trim().replace(/^#/, "").toLowerCase();
  if (!/^[0-9a-f]{1,8}$/.test(digits)) return null;
  return {
    gte: `${digits.padEnd(8, "0")}-0000-0000-0000-000000000000`,
    lt: `${digits.padEnd(8, "f")}-ffff-ffff-ffff-ffffffffffff`,
  };
}

/** Remove caracteres que são sintaxe dos filtros do PostgREST (ilike/or). */
export function escapeSearchTerm(term: string) {
  return term.trim().replace(/[%_,()"*]/g, "");
}

/** Página vinda da URL: só números inteiros maiores que zero. */
export function parsePageParam(pg: unknown): number | undefined {
  return typeof pg === "number" && pg > 0
    ? Math.floor(pg)
    : typeof pg === "string" && /^\d+$/.test(pg) && Number(pg) > 0
      ? Number(pg)
      : undefined;
}

/** Filtros da lista de pedidos na URL, para sobreviverem à ida ao detalhe e à volta. */
export type OrderListSearch = {
  q?: string | undefined;
  status?: string | undefined;
  origem?: string | undefined;
  de?: string | undefined;
  ate?: string | undefined;
  pagina?: number | undefined;
};

export function orderListSearch(s: Record<string, unknown>): OrderListSearch {
  return {
    q: typeof s["q"] === "string" ? s["q"] : undefined,
    status: typeof s["status"] === "string" ? s["status"] : undefined,
    origem: typeof s["origem"] === "string" ? s["origem"] : undefined,
    de: typeof s["de"] === "string" ? s["de"] : undefined,
    ate: typeof s["ate"] === "string" ? s["ate"] : undefined,
    pagina: parsePageParam(s["pagina"]),
  };
}
