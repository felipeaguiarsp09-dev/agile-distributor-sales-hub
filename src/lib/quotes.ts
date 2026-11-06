import { parsePageParam } from "./orders";

/** Estados do orçamento; o banco só aceita estes três. */
export const QUOTE_STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  convertido: "Convertido em pedido",
  cancelado: "Cancelado",
};

/** Data local no formato YYYY-MM-DD (comparável por string). */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayISO(d: Date = new Date()): string {
  return isoDate(d);
}

/** Data de hoje somando N dias, no formato YYYY-MM-DD. */
export function dateInDays(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

/** Validade vencida: sem data definida o orçamento não vence. O último dia ainda vale. */
export function isQuoteExpired(validUntil: string | null | undefined, today: string = todayISO()): boolean {
  return !!validUntil && validUntil < today;
}

/** Filtros da lista de orçamentos na URL. */
export type QuoteListSearch = {
  q?: string | undefined;
  status?: string | undefined;
  pagina?: number | undefined;
};

export function quoteListSearch(s: Record<string, unknown>): QuoteListSearch {
  return {
    q: typeof s["q"] === "string" ? s["q"] : undefined,
    status: typeof s["status"] === "string" ? s["status"] : undefined,
    pagina: parsePageParam(s["pagina"]),
  };
}
