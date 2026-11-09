export function parseCountTarget(value: string): number | null {
  if (!value.trim()) return null;
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0 || count > 2147483647) throw new Error("Informe uma quantidade inteira igual ou maior que zero");
  return count;
}

/** Meta de faturamento em R$: aceita "1.234,56", "1234,56" ou "1234.56"; vazio = sem meta (0). */
export function parseMoneyTarget(value: string): number {
  const v = value.trim().replace(/^R\$\s*/, "");
  if (!v) return 0;
  const normalized = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0 || n > 1e12) throw new Error("Informe um valor de faturamento igual ou maior que zero");
  return Math.round(n * 100) / 100;
}
