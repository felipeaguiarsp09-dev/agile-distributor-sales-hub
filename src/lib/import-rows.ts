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
  seller_name: string;
};

export function toCustomer(r: Record<string, string>, row: number): CustomerRow | RowError {
  const name = pick(r, "name", "nome", "razao_social", "cliente");
  if (!name) return { row, error: "nome obrigatório" };
  const doc = pick(r, "cnpj_cpf", "cnpj", "cpf", "documento");
  if (doc && !validDocument(doc)) return { row, error: "cnpj_cpf inválido" };
  const limit = parseMoney(pick(r, "credit_limit", "limite", "limite_de_credito", "limite_credito"));
  if (limit === null || limit < 0) return { row, error: "limite de crédito inválido" };
  const status = (pick(r, "credit_status", "situacao", "situacao_credito") || "ok").toLowerCase();
  if (!["ok", "restrito", "bloqueado"].includes(status)) return { row, error: "situação de crédito inválida" };
  const address: Record<string, string> = {};
  for (const [key, ...alts] of [
    ["street", "endereco", "logradouro"],
    ["city", "cidade"],
    ["state", "uf", "estado"],
    ["zip", "cep"],
  ]) {
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

export const isRowError = (x: unknown): x is RowError =>
  typeof x === "object" && x !== null && "error" in x && "row" in x;
