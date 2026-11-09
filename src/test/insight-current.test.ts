import { describe, expect, it } from "vitest";
import { insightIsCurrent } from "@/lib/indicators";

describe("insightIsCurrent", () => {
  it("análise com o mesmo faturamento e meta continua valendo", () => {
    expect(insightIsCurrent({ faturado_mes: 23.5, meta: 100 }, { faturado_mes: 23.5, meta: 100 })).toBe(true);
  });
  it("faturamento diferente exige nova análise", () => {
    expect(insightIsCurrent({ faturado_mes: 5, meta: 0 }, { faturado_mes: 23.5, meta: 0 })).toBe(false);
  });
  it("meta diferente exige nova análise", () => {
    expect(insightIsCurrent({ faturado_mes: 5, meta: 0 }, { faturado_mes: 5, meta: 50 })).toBe(false);
  });
  it("análise antiga sem faturamento salvo exige nova análise", () => {
    expect(insightIsCurrent({ meta: 0 }, { faturado_mes: 5, meta: 0 })).toBe(false);
  });
});
