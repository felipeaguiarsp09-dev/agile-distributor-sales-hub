import { describe, expect, it } from "vitest";
import { canRegisterVisit, canViewCheckInLocation, checkInDayRange, customerVisitAddress } from "@/lib/agenda";

describe("regras de check-in", () => {
  it("exige check-in salvo antes do registro da visita", () => {
    expect(canRegisterVisit(null)).toBe(false);
    expect(canRegisterVisit(undefined)).toBe(false);
    expect(canRegisterVisit("inválido")).toBe(false);
    expect(canRegisterVisit("2026-11-12T20:51:00Z")).toBe(true);
  });
  it("usa apenas o endereço cadastrado do cliente", () => {
    expect(customerVisitAddress({ street: "Rua A", number: "42", city: "São Paulo", state: "SP", check_in_lat: "-23.1" })).toBe("Rua A, 42, São Paulo, SP");
  });
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