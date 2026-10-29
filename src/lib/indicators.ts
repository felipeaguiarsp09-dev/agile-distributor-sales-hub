export type Indicators = {
  meta: number;
  vendas_mes: number;
  ticket_medio: number;
  pedidos_count: number;
  daily: { day: string; total: number }[];
  clientes_atendidos: number;
  meta_clientes: number | null;
  clientes_a_atender: number | null;
  visitas_realizadas: number;
};

export type InsightScope = { scope: "vendedor" | "equipe" | "global"; scope_ref_id: string | null };

/** Escopo da leitura da IA conforme o papel (docs/PAGINAS.md → /indicadores). */
export function insightScope(role: string | undefined, userId: string, sellerId: string | null): InsightScope {
  if (role === "vendedor") return { scope: "vendedor", scope_ref_id: userId };
  if (role === "supervisor") return sellerId ? { scope: "vendedor", scope_ref_id: sellerId } : { scope: "equipe", scope_ref_id: userId };
  if (role === "administrador") return sellerId ? { scope: "vendedor", scope_ref_id: sellerId } : { scope: "global", scope_ref_id: null };
  throw new Error("Sem acesso aos indicadores");
}

export function currentPeriod(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function lastPeriods(n: number, d = new Date()) {
  return Array.from({ length: n }, (_, i) => currentPeriod(new Date(d.getFullYear(), d.getMonth() - i, 1)));
}

export function progressPct(meta: number, vendas: number) {
  return meta > 0 ? Math.round((vendas / meta) * 100) : 0;
}
