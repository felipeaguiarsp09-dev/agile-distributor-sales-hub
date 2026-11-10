import { describe, expect, it } from "vitest";
import { modulesForRole } from "@/lib/modules";
import { homeForRole } from "@/lib/auth";

describe("menu por papel", () => {
  it("vendedor vê os 6 módulos (histórico unificado em Pedidos)", () => {
    const items = modulesForRole("vendedor");
    expect(items).toHaveLength(6);
    expect(items.map((m) => m.to as string)).not.toContain("/historico");
    expect(items.some((m) => m.to === "/pedidos")).toBe(true);
  });
  it.skip("o primeiro módulo do menu se chama Dashboard (oculto: app só cria pedidos)", () => {
    const items = modulesForRole("vendedor");
    expect(items[0]?.label).toBe("Dashboard");
    expect(items.find((m) => m.to === "/indicadores")?.label).toBe("Dashboard");
  });
  it("E-commerce removido: nenhum papel vê o módulo e cliente final fica sem menu", () => {
    for (const r of ["administrador", "supervisor", "vendedor", "cliente"]) expect(modulesForRole(r).some((m) => m.to === ("/ecommerce" as string))).toBe(false);
    expect(modulesForRole("cliente")).toEqual([]);
  });
  it("somente administrador e supervisor podem acessar metas mensais", () => {
    expect(modulesForRole("administrador").some(m => m.to === "/metas")).toBe(true);
    expect(modulesForRole("supervisor").some(m => m.to === "/metas")).toBe(true);
    expect(modulesForRole("vendedor").some(m => m.to === "/metas")).toBe(false);
    expect(modulesForRole("cliente").some(m => m.to === "/metas")).toBe(false);
  });
  it("equipe interna vai para /pedidos", () => {
    expect(homeForRole("supervisor")).toBe("/pedidos");
  });
});

describe("app só de pedidos", () => {
  it("menu não mostra Dashboard, Agenda nem Metas", () => {
    const paths = modulesForRole("administrador").map((m) => m.to as string);
    expect(paths).not.toContain("/indicadores");
    expect(paths).not.toContain("/agenda");
    expect(paths).not.toContain("/metas");
    expect(paths).toContain("/pedidos");
  });
});
