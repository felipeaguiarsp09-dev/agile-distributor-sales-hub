import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, authMiddleware } = vi.hoisted(() => ({ rpc: vi.fn(), authMiddleware: {} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: authMiddleware }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate: { parse: (data: unknown) => unknown } | ((data: unknown) => unknown);
    const builder = {
      middleware: (middleware: unknown[]) => {
        expect(middleware).toContain(authMiddleware);
        return builder;
      },
      inputValidator: (validator: typeof validate) => { validate = validator; return builder; },
      handler: (handler: (input: unknown) => unknown) => (input: { data: unknown }) =>
        handler({ data: typeof validate === "function" ? validate(input.data) : validate.parse(input.data), context: { supabase: { rpc } } }),
    };
    return builder;
  },
}));

import { getDashboardIndicators } from "@/lib/indicators.functions";

describe("Dashboard authenticated first read", () => {
  beforeEach(() => rpc.mockReset());
  it("returns metrics from one verified RPC without a seller filter for the default scope", async () => {
    const metrics = { meta: 6000, vendas_mes: 31.5, ticket_medio: 10.5, pedidos_count: 3, daily: [], clientes_atendidos: 2, meta_clientes: 10, clientes_a_atender: 8, visitas_realizadas: 1 };
    rpc.mockResolvedValue({ data: metrics, error: null });
    expect(await getDashboardIndicators({ data: { period: "2026-10", seller_id: null } })).toEqual(metrics);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("get_seller_indicators", { p_period: "2026-10", p_seller_id: null });
  });
  it("propagates the first RPC failure instead of retrying or showing empty metrics", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Read failed" } });
    await expect(getDashboardIndicators({ data: { period: "2026-10", seller_id: null } })).rejects.toThrow("Read failed");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});