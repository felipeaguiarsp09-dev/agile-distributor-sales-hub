import { describe, expect, it } from "vitest";
import { parseMoneyTarget } from "@/lib/monthly-targets";

describe("parseMoneyTarget", () => {
  it("aceita valor com vírgula e milhar", () => expect(parseMoneyTarget("1.234,56")).toBe(1234.56));
  it("aceita valor com ponto decimal", () => expect(parseMoneyTarget("50.5")).toBe(50.5));
  it("vazio significa sem meta", () => expect(parseMoneyTarget("")).toBe(0));
  it("recusa valor negativo", () => expect(() => parseMoneyTarget("-10")).toThrow());
});
