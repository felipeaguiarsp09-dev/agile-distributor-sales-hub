export const canViewCheckInLocation = (role: string | undefined) =>
  role === "administrador" || role === "supervisor";

export const canRegisterVisit = (checkInAt: string | null | undefined) =>
  typeof checkInAt === "string" && Number.isFinite(Date.parse(checkInAt));

export function customerVisitAddress(address: unknown) {
  const addr = (address ?? {}) as Record<string, string>;
  return [addr["street"], addr["number"], addr["complement"], addr["neighborhood"], addr["city"], addr["state"], addr["zip_code"]].filter(Boolean).join(", ");
}

export function checkInDayRange(now: Date) {
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(now);
  const from = new Date(`${day}T00:00:00-03:00`);
  return { from: from.toISOString(), to: new Date(from.getTime() + 86400000).toISOString() };
}