export type Indicators = {
  meta: number;
  vendas_mes: number;
  ticket_medio: number;
  pedidos_count: number;
  daily: { day: string; total: number }[];
  clientes_atendidos: number;
  clientes_positivados?: number;
  clientes_ativados?: number;
  faturado_mes?: number;
  devolucao?: number;
  meta_clientes: number | null;
  clientes_a_atender: number | null;
  visitas_realizadas: number;
  meta_visitas: number | null;
  visitas_a_realizar: number | null;
};

export type UnservedCustomer = { id: string; name: string; cnpj_cpf: string | null; phone: string | null };

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

export type UnmetTargets = { sales: number | null; customers: number | null; visits: number | null };

/** Quanto falta em cada meta do período (null = meta atingida ou não definida). */
export function unmetTargets(d: Indicators | null | undefined): UnmetTargets {
  if (!d) return { sales: null, customers: null, visits: null };
  return {
    sales: d.meta > 0 && (d.faturado_mes ?? d.vendas_mes) < d.meta ? Math.round((d.meta - (d.faturado_mes ?? d.vendas_mes)) * 100) / 100 : null,
    customers: d.meta_clientes != null && (d.clientes_positivados ?? d.clientes_atendidos) < d.meta_clientes ? Math.max(d.meta_clientes - (d.clientes_positivados ?? d.clientes_atendidos), 0) : null,
    visits: d.meta_visitas != null && d.visitas_realizadas < d.meta_visitas ? Math.max(d.meta_visitas - d.visitas_realizadas, 0) : null,
  };
}

/** Rótulo do horário da última leitura bem-sucedida dos indicadores (null quando ainda não há leitura). */
export function lastUpdatedLabel(dataUpdatedAt: number | undefined): string | null {
  if (!dataUpdatedAt) return null;
  return `Atualizado às ${new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

/** Meta mensal de visitas dividida por 30: visitas por dia, arredondado para cima. */
export function dailyVisitTarget(monthly: number | null | undefined): number | null {
  return monthly == null || monthly <= 0 ? null : Math.ceil(monthly / 30);
}
