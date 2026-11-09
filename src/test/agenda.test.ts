import { describe, expect, it } from "vitest";
import { canViewCheckInLocation, checkInDayRange } from "@/lib/agenda";

describe("regras de check-in", () => {
  it("usa o dia de São Paulo para limitar check-ins", () => {
    expect(checkInDayRange(new Date("2026-11-10T02:59:59Z"))).toEqual({
      from: "2026-11-09T03:00:00.000Z", to: "2026-11-10T03:00:00.000Z",
    });
    expect(checkInDayRange(new Date("2026-11-10T03:00:00Z")).from).toBe("2026-11-10T03:00:00.000Z");
  });
  it("oculta a localização para o vendedor", () => {
    expect(canViewCheckInLocation("vendedor")).toBe(false);
    expect(canViewCheckInLocation(undefined)).toBe(false);
  });
  it("mantém a localização para supervisor e administrador", () => {
    expect(canViewCheckInLocation("supervisor")).toBe(true);
    expect(canViewCheckInLocation("administrador")).toBe(true);
  });
});