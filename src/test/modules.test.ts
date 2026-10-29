import { describe, expect, it } from "vitest";
import { modulesForRole } from "@/lib/modules";
import { homeForRole } from "@/lib/auth";

describe("menu por papel", () => {
  it("vendedor vê os 7 módulos", () => {
    expect(modulesForRole("vendedor")).toHaveLength(7);
  });
  it("o primeiro módulo do menu se chama Dashboard", () => {
    const items = modulesForRole("vendedor");
    expect(items[0]?.label).toBe("Dashboard");
    expect(items.find((m) => m.to === "/indicadores")?.label).toBe("Dashboard");
  });
  it("cliente final vê apenas o E-commerce", () => {
    expect(modulesForRole("cliente").map((m) => m.to)).toEqual(["/ecommerce"]);
  });
  it("somente administrador e supervisor podem acessar metas mensais", () => {
    expect(modulesForRole("administrador").some(m => m.to === "/metas")).toBe(true);
    expect(modulesForRole("supervisor").some(m => m.to === "/metas")).toBe(true);
    expect(modulesForRole("vendedor").some(m => m.to === "/metas")).toBe(false);
    expect(modulesForRole("cliente").some(m => m.to === "/metas")).toBe(false);
  });
  it("cliente vai para /ecommerce e equipe interna para /indicadores", () => {
    expect(homeForRole("cliente")).toBe("/ecommerce");
    expect(homeForRole("supervisor")).toBe("/indicadores");
  });
});
