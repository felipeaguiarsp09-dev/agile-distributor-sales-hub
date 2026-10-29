import { describe, expect, it } from "vitest";
import { unmetTargets } from "@/lib/indicators";

const base = {
  meta: 0,
  vendas_mes: 0,
  ticket_medio: 0,
  pedidos_count: 0,
  daily: [],
  clientes_atendidos: 0,
  meta_clientes: null,
  clientes_a_atender: null,
  visitas_realizadas: 0,
  meta_visitas: null,
  visitas_a_realizar: null,
};

describe("unmetTargets", () => {
  it("mostra quanto falta em vendas, clientes e visitas quando a meta não foi atingida", () => {
    const u = unmetTargets({
      ...base,
      meta: 6000,
      vendas_mes: 3150,
      meta_clientes: 10,
      clientes_atendidos: 2,
      clientes_a_atender: 8,
      meta_visitas: 20,
      visitas_realizadas: 12,
      visitas_a_realizar: 8,
    });
    expect(u.sales).toBe(2850);
    expect(u.customers).toBe(8);
    expect(u.visits).toBe(8);
  });

  it("não destaca metas atingidas ou superadas", () => {
    const u = unmetTargets({
      ...base,
      meta: 1000,
      vendas_mes: 1000,
      meta_clientes: 5,
      clientes_atendidos: 6,
      clientes_a_atender: 0,
      meta_visitas: 3,
      visitas_realizadas: 4,
      visitas_a_realizar: 0,
    });
    expect(u).toEqual({ sales: null, customers: null, visits: null });
  });

  it("não destaca quando a meta não está definida", () => {
    expect(unmetTargets(base)).toEqual({ sales: null, customers: null, visits: null });
  });

  it("retorna nulos sem dados", () => {
    expect(unmetTargets(null)).toEqual({ sales: null, customers: null, visits: null });
  });
});
