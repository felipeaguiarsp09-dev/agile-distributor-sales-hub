/** O ERP sincroniza o estoque de hora em hora; acima de 2 horas o saldo é considerado desatualizado. */
export const STOCK_STALE_AFTER_MS = 2 * 60 * 60 * 1000;

export function isStockStale(lastSyncAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!lastSyncAt) return true;
  const t = new Date(lastSyncAt).getTime();
  if (Number.isNaN(t)) return true;
  return now.getTime() - t > STOCK_STALE_AFTER_MS;
}
