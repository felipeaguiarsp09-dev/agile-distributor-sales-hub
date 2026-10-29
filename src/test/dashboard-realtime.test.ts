import { QueryClient, QueryObserver } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { subscribeDashboardOrders } from "@/lib/dashboard-realtime";

function realtime() {
  let change: (payload: unknown) => void = () => {};
  let status: (value: string) => void = () => {};
  const channel = {
    on: vi.fn((_kind, _filter, callback) => { change = callback; return channel; }),
    subscribe: vi.fn((callback) => { status = callback; return channel; }),
  };
  const client = { channel: vi.fn(() => channel), removeChannel: vi.fn() };
  return {
    client: client as unknown as Pick<SupabaseClient, "channel" | "removeChannel">,
    channel,
    change: (value: unknown) => change(value),
    connected: () => status("SUBSCRIBED"),
  };
}

describe("Dashboard order refresh", () => {
  it.each(["aprovado", "faturado"])("refreshes metrics and unserved customers when an order becomes %s, preserving the selected month", async (status) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const metricKey = ["indicators", "seller-1", "2025-03", null];
    const listKey = ["unserved-customers", "seller-1", "2025-03", null];
    const otherMonth = ["indicators", "seller-1", "2026-10", null];
    const otherUser = ["indicators", "seller-2", "2025-03", null];
    qc.setQueryData(metricKey, { clientes_atendidos: 0 });
    qc.setQueryData(listKey, [{ id: "customer-1" }]);
    qc.setQueryData(otherMonth, { clientes_atendidos: 4 });
    qc.setQueryData(otherUser, { clientes_atendidos: 7 });
    const metrics = vi.fn(async () => ({ clientes_atendidos: 1 }));
    const customers = vi.fn(async () => []);
    const metricObserver = new QueryObserver(qc, { queryKey: metricKey, queryFn: metrics });
    const listObserver = new QueryObserver(qc, { queryKey: listKey, queryFn: customers });
    const stopMetrics = metricObserver.subscribe(() => {});
    const stopList = listObserver.subscribe(() => {});
    const rt = realtime();
    const cleanup = subscribeDashboardOrders(rt.client, qc, "seller-1");
    rt.change({ eventType: "UPDATE", new: { status, created_at: "2025-03-15T12:00:00Z" } });
    await vi.waitFor(() => {
      expect(qc.getQueryData(metricKey)).toEqual({ clientes_atendidos: 1 });
      expect(qc.getQueryData(listKey)).toEqual([]);
    });
    expect(metrics).toHaveBeenCalledTimes(1);
    expect(customers).toHaveBeenCalledTimes(1);
    expect(qc.getQueryData(otherMonth)).toEqual({ clientes_atendidos: 4 });
    expect(qc.getQueryState(otherMonth)?.isInvalidated).toBe(true);
    expect(qc.getQueryState(otherUser)?.isInvalidated).toBe(false);
    stopMetrics(); stopList(); cleanup(); qc.clear();
  });

  it.each(["aprovado", "faturado"])("recalculates sales and coverage after cancellation of an %s order in the selected month", async (previousStatus) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const metricKey = ["indicators", "seller-1", "2025-03", null];
    const listKey = ["unserved-customers", "seller-1", "2025-03", null];
    const otherMonth = ["indicators", "seller-1", "2026-10", null];
    let orderStatus = previousStatus;
    const calculate = () => {
      const counted = orderStatus === "aprovado" || orderStatus === "faturado";
      return { vendas_mes: counted ? 75 : 0, clientes_atendidos: counted ? 1 : 0, clientes_a_atender: counted ? 9 : 10 };
    };
    qc.setQueryData(metricKey, calculate());
    qc.setQueryData(listKey, []);
    qc.setQueryData(otherMonth, { vendas_mes: 100 });
    const metrics = new QueryObserver(qc, { queryKey: metricKey, queryFn: async () => calculate() });
    const customers = new QueryObserver(qc, { queryKey: listKey, queryFn: async () => orderStatus === "cancelado" ? [{ id: "customer-1" }] : [] });
    const stopMetrics = metrics.subscribe(() => {});
    const stopCustomers = customers.subscribe(() => {});
    const rt = realtime();
    const cleanup = subscribeDashboardOrders(rt.client, qc, "seller-1");
    orderStatus = "cancelado";
    rt.change({ eventType: "UPDATE", old: { status: previousStatus }, new: { status: "cancelado", created_at: "2025-03-15T12:00:00Z" } });
    await vi.waitFor(() => {
      expect(qc.getQueryData(metricKey)).toEqual({ vendas_mes: 0, clientes_atendidos: 0, clientes_a_atender: 10 });
      expect(qc.getQueryData(listKey)).toEqual([{ id: "customer-1" }]);
    });
    expect(qc.getQueryData(otherMonth)).toEqual({ vendas_mes: 100 });
    stopMetrics(); stopCustomers(); cleanup(); qc.clear();
  });

  it("invalidates a closed list on connection/reconnection and removes its unique channel on unmount", () => {
    const qc = new QueryClient();
    const key = ["unserved-customers", "seller-1", "2025-03", null];
    qc.setQueryData(key, [{ id: "customer-1" }]);
    const rt = realtime();
    const cleanup = subscribeDashboardOrders(rt.client, qc, "seller-1");
    const cleanup2 = subscribeDashboardOrders(rt.client, qc, "seller-1");
    expect(rt.client.channel).toHaveBeenCalledTimes(2);
    const names = vi.mocked(rt.client.channel).mock.calls.map(call => call[0]);
    expect(names[0]).not.toBe(names[1]);
    expect(rt.channel.on).toHaveBeenCalledWith("postgres_changes", { event: "*", schema: "public", table: "orders" }, expect.any(Function));
    rt.connected();
    expect(qc.getQueryState(key)?.isInvalidated).toBe(true);
    cleanup(); cleanup2();
    expect(rt.client.removeChannel).toHaveBeenCalledTimes(2);
    qc.clear();
  });
});