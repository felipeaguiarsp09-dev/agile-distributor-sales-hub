export const canViewCheckInLocation = (role: string | undefined) =>
  role === "administrador" || role === "supervisor";

export function checkInDayRange(now: Date) {
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(now);
  const from = new Date(`${day}T00:00:00-03:00`);
  return { from: from.toISOString(), to: new Date(from.getTime() + 86400000).toISOString() };
}