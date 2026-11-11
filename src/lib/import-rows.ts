/** Conversão das linhas da planilha/ERP para registros do banco (import-erp-data). */

export type RowError = { row: number; error: string };

const pick = (r: Record<string, string>, ...keys: string[]) => {
  for (const k of keys) if (r[k] !== undefined && r[k] !== "") return r[k];
  return "";
};

/** Aceita "1.234,56", "1234.56" e "1234". */
export function parseMoney(v: string): number | null {
  if (!v) return 0;
  let s = v.replace(/[R$\s]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseBool(v: string) {
  return ["sim", "s", "true", "1", "yes", "x"].includes(v.trim().toLowerCase());
}

export function validDocument(v: string) {
  const d = v.replace(/\D/g, "");
  return d.length === 11 || d.length === 14;
}

export type CustomerRow = {
  external_id: string | null;
  name: string;
  cnpj_cpf: string | null;
  email: string | null;
  phone: string | null;
  address: Record<string, string>;
  credit_limit: number;
  credit_status: "ok" | "restrito" | "bloqueado";
  is_active: boolean;
  seller_name: string;
};

export function toCustomer(r: Record<string, string>, row: number): CustomerRow | RowError {
  const name = pick(r, "name", "nome", "razao_social", "cliente");
  if (!name) return { row, error: "nome obrigatório" };
  const doc = pick(r, "cnpj_cpf", "cnpj", "cpf", "documento");
  if (doc && !validDocument(doc)) return { row, error: "cnpj_cpf inválido" };
  const limit = parseMoney(pick(r, "credit_limit", "limite", "limite_de_credito", "limite_credito"));
  if (limit === null || limit < 0) return { row, error: "limite de crédito inválido" };
  const rawStatus = (pick(r, "credit_status", "situacao", "situacao_credito") || "ok").toLowerCase();
  const status = rawStatus === "liberado" ? "ok" : rawStatus;
  if (!["ok", "restrito", "bloqueado"].includes(status)) return { row, error: "situação de crédito inválida" };
  const rawActive = (pick(r, "is_active", "ativo", "status_cliente", "status") || "ativo").toLowerCase();
  if (!["ativo", "inativo", "sim", "nao", "não", "true", "false", "1", "0"].includes(rawActive)) return { row, error: "status ativo/inativo inválido" };
  const is_active = ["ativo", "sim", "true", "1"].includes(rawActive);
  const address: Record<string, string> = {};
  for (const [key, ...alts] of [
    ["street", "endereco", "logradouro"],
    ["city", "cidade"],
    ["state", "uf", "estado"],
    ["zip", "cep"],
  ] as const) {
    const v = pick(r, key, ...alts);
    if (v) address[key] = v;
  }
  return {
    external_id: pick(r, "external_id", "codigo", "cod", "id_erp") || null,
    name,
    cnpj_cpf: doc || null,
    email: pick(r, "email", "e_mail") || null,
    phone: pick(r, "phone", "telefone", "fone", "celular") || null,
    address,
    credit_limit: limit,
    credit_status: status as CustomerRow["credit_status"],
    is_active,
    seller_name: pick(r, "vendedor", "seller", "owner"),
  };
}

export type ProductRow = {
  external_id: string | null;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  unit_price: number;
  stock_quantity: number;
  is_ecommerce_visible: boolean;
  is_active: boolean;
};

export function toProduct(r: Record<string, string>, row: number): ProductRow | RowError {
  const sku = pick(r, "sku", "codigo_produto", "referencia", "ref");
  const name = pick(r, "name", "nome", "descricao_curta", "produto");
  if (!sku) return { row, error: "sku obrigatório" };
  if (!name) return { row, error: "nome obrigatório" };
  const price = parseMoney(pick(r, "unit_price", "preco", "preco_unitario", "valor"));
  if (price === null || price < 0) return { row, error: "preço inválido" };
  const stockRaw = pick(r, "stock_quantity", "estoque", "quantidade") || "0";
  const stock = Number(stockRaw.replace(/\./g, "").replace(",", "."));
  if (!Number.isInteger(stock)) return { row, error: "estoque inválido" };
  const active = pick(r, "is_active", "ativo");
  return {
    external_id: pick(r, "external_id", "id_erp", "cod") || null,
    sku,
    name,
    description: pick(r, "description", "descricao") || null,
    category: pick(r, "category", "categoria") || null,
    unit_price: price,
    stock_quantity: stock,
    is_ecommerce_visible: parseBool(pick(r, "is_ecommerce_visible", "ecommerce", "visivel_ecommerce")),
    is_active: active ? parseBool(active) : true,
  };
}

export type PaymentMethodRow = { code: string; name: string; requires_days: boolean; is_active: boolean };
export function toPaymentMethod(r: Record<string, string>, row: number): PaymentMethodRow | RowError {
  const code = pick(r, "code", "codigo", "external_id", "id_erp", "cod");
  const name = pick(r, "name", "nome", "descricao", "forma_pagamento");
  if (!code) return { row, error: "código obrigatório" };
  if (!name) return { row, error: "nome obrigatório" };
  const active = pick(r, "is_active", "ativo");
  return { code, name, requires_days: parseBool(pick(r, "requires_days", "exige_prazo", "prazo")), is_active: active ? parseBool(active) : true };
}

export const isRowError = (x: unknown): x is RowError =>
  typeof x === "object" && x !== null && "error" in x && "row" in x;

export type OrderLineRow = {
  order_code: string;
  customer_code: string;
  sku: string;
  quantity: number;
  unit_price: number | null;
  created_at: string | null;
  status: string;
  discount: number;
  returned: number;
  seller_name: string;
};

const ORDER_STATUSES = ["rascunho", "aguardando_aprovacao", "aprovado", "recusado", "faturado", "entregue", "cancelado"];

/** Converte "dd/mm/aaaa" ou "aaaa-mm-dd" em ISO. */
export function parseDate(v: string): string | null | undefined {
  if (!v) return null;
  const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  const iso = br ? `${br[3]}-${br[2]}-${br[1]}` : v;
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00-03:00` : iso);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Uma linha por item; linhas com o mesmo código de pedido formam um pedido. */
export function toOrderLine(r: Record<string, string>, row: number): OrderLineRow | RowError {
  const order_code = pick(r, "codigo_pedido", "pedido", "numero_pedido", "external_id");
  const customer_code = pick(r, "codigo_cliente", "cliente_codigo", "cliente");
  const sku = pick(r, "sku", "codigo_produto", "referencia");
  if (!order_code) return { row, error: "código do pedido obrigatório" };
  if (!customer_code) return { row, error: "código do cliente obrigatório" };
  if (!sku) return { row, error: "sku obrigatório" };
  const quantity = Number(pick(r, "quantidade", "qtd", "quantity"));
  if (!Number.isInteger(quantity) || quantity <= 0) return { row, error: "quantidade inválida" };
  const priceRaw = pick(r, "preco_unitario", "preco", "unit_price");
  const unit_price = priceRaw ? parseMoney(priceRaw) : null;
  if (priceRaw && (unit_price === null || unit_price < 0)) return { row, error: "preço inválido" };
  const created_at = parseDate(pick(r, "data", "data_pedido", "created_at"));
  if (created_at === undefined) return { row, error: "data inválida" };
  const status = (pick(r, "status", "situacao") || "faturado").toLowerCase();
  if (!ORDER_STATUSES.includes(status)) return { row, error: "status inválido" };
  const discount = parseMoney(pick(r, "desconto", "discount"));
  if (discount === null || discount < 0) return { row, error: "desconto inválido" };
  const returned = parseMoney(pick(r, "devolucao", "valor_devolvido", "returned_amount"));
  if (returned === null || returned < 0) return { row, error: "devolução inválida" };
  return { order_code, customer_code, sku, quantity, unit_price, created_at, status, discount, returned, seller_name: pick(r, "vendedor", "seller") };
}

export type ExistingProduct = { id: string; external_id: string | null; sku: string };
export type ProductPlanStep =
  | { kind: "update"; id: string; record: Partial<ProductRow> }
  | { kind: "insert"; record: ProductRow };

/** Decide, para uma linha válida, se atualiza um produto existente ou cria um novo.
 *  Linha com ID do ERP: vincula pelo ID; senão pelo código de um produto ainda sem ID.
 *  Linha sem ID: vincula pelo código a qualquer produto e preserva o ID já gravado.
 *  Código que aponta para mais de um produto é recusado para não alterar o item errado. */
export function planProductRow(existing: ExistingProduct[], r: ProductRow, row: number): ProductPlanStep | RowError {
  if (r.external_id) {
    const byExt = existing.find((p) => p.external_id === r.external_id);
    if (byExt) return { kind: "update", id: byExt.id, record: r };
    const unlinked = existing.filter((p) => !p.external_id && p.sku === r.sku);
    if (unlinked.length > 1) return { row, error: `SKU ambíguo: ${r.sku}` };
    return unlinked[0] ? { kind: "update", id: unlinked[0].id, record: r } : { kind: "insert", record: r };
  }
  const { external_id: _drop, ...rest } = r;
  const matches = existing.filter((p) => p.sku === r.sku);
  if (matches.length > 1) return { row, error: `SKU ambíguo: ${r.sku} (${matches.length} produtos)` };
  return matches[0] ? { kind: "update", id: matches[0].id, record: rest } : { kind: "insert", record: r };
}
