import { describe, expect, it } from "vitest";

import { QUOTE_STATUS_LABEL, dateInDays, isQuoteExpired, quoteListSearch } from "@/lib/quotes";

describe("validade do orçamento", () => {
  it("vence no dia seguinte ao último dia válido", () => {
    expect(isQuoteExpired("2026-03-10", "2026-03-11")).toBe(true);
    expect(isQuoteExpired("2026-03-10", "2026-03-10")).toBe(false);
    expect(isQuoteExpired("2026-03-10", "2026-03-09")).toBe(false);
  });

  it("sem data de validade não vence", () => {
    expect(isQuoteExpired(null)).toBe(false);
    expect(isQuoteExpired(undefined)).toBe(false);
    expect(isQuoteExpired("")).toBe(false);
  });

  it("a validade padrão cai exatamente uma semana à frente", () => {
    expect(dateInDays(7, new Date(2026, 2, 3))).toBe("2026-03-10");
    expect(dateInDays(7, new Date(2026, 2, 30))).toBe("2026-04-06");
  });
});

describe("status do orçamento", () => {
  it("mostra exatamente os estados que o banco aceita", () => {
    expect(Object.keys(QUOTE_STATUS_LABEL)).toEqual(["aberto", "convertido", "cancelado"]);
    expect(QUOTE_STATUS_LABEL.convertido).toBe("Convertido em pedido");
  });
});

describe("filtros da lista de orçamentos", () => {
  it("mantém busca, status e página da URL", () => {
    expect(quoteListSearch({ q: "emp", status: "aberto", pagina: "3" })).toEqual({ q: "emp", status: "aberto", pagina: 3 });
  });

  it("descarta página inválida", () => {
    expect(quoteListSearch({ pagina: "0" }).pagina).toBeUndefined();
    expect(quoteListSearch({ pagina: "-2" }).pagina).toBeUndefined();
    expect(quoteListSearch({ pagina: "abc" }).pagina).toBeUndefined();
  });
});
