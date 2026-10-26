import { describe, expect, it } from "vitest";
import { insightScope, progressPct } from "@/lib/indicators";

describe("escopo dos indicadores", () => {
  it("vendedor sempre vê só os próprios números", () => {
    expect(insightScope("vendedor", "u1", "outro")).toEqual({ scope: "vendedor", scope_ref_id: "u1" });
  });
  it("supervisor vê a equipe ou um vendedor", () => {
    expect(insightScope("supervisor", "s1", null)).toEqual({ scope: "equipe", scope_ref_id: "s1" });
    expect(insightScope("supervisor", "s1", "v1")).toEqual({ scope: "vendedor", scope_ref_id: "v1" });
  });
  it("administrador vê o global", () => {
    expect(insightScope("administrador", "a1", null)).toEqual({ scope: "global", scope_ref_id: null });
  });
  it("cliente não tem acesso", () => {
    expect(() => insightScope("cliente", "c1", null)).toThrow();
  });
  it("progresso da meta", () => {
    expect(progressPct(100000, 72000)).toBe(72);
    expect(progressPct(0, 500)).toBe(0);
  });
});
