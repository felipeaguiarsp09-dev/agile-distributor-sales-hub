import { describe, expect, it } from "vitest";
import { modulesForRole } from "@/lib/modules";
import { homeForRole } from "@/lib/auth";

describe("menu por papel", () => {
  it("vendedor vê os 7 módulos", () => {
    expect(modulesForRole("vendedor")).toHaveLength(7);
  });
  it("cliente final vê apenas o E-commerce", () => {
    expect(modulesForRole("cliente").map((m) => m.to)).toEqual(["/ecommerce"]);
  });
  it("cliente vai para /ecommerce e equipe interna para /indicadores", () => {
    expect(homeForRole("cliente")).toBe("/ecommerce");
    expect(homeForRole("supervisor")).toBe("/indicadores");
  });
});
