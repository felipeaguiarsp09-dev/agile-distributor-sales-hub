export function parseCountTarget(value: string): number | null {
  if (!value.trim()) return null;
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0 || count > 2147483647) throw new Error("Informe uma quantidade inteira igual ou maior que zero");
  return count;
}