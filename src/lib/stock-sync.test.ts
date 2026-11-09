import { describe, expect, it } from "vitest";
import { isStockStale } from "./stock-sync";

const now = new Date("2026-11-09T17:00:00Z");
describe("isStockStale", () => {
  it("nunca sincronizado é desatualizado", () => expect(isStockStale(null, now)).toBe(true));
  it("sincronizado há 1h está em dia", () => expect(isStockStale("2026-11-09T16:00:00Z", now)).toBe(false));
  it("sincronizado há mais de 2h está desatualizado", () => expect(isStockStale("2026-11-09T14:59:00Z", now)).toBe(true));
});
