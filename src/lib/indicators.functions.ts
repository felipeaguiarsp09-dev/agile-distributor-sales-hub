import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { insightScope, type Indicators } from "./indicators";

/** Read through the verified request client, never a browser session in transition. */
export const getDashboardIndicators = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    seller_id: z.string().uuid().nullable(),
  }))
  .handler(async ({ data, context }) => {
    const { data: indicators, error } = await context.supabase.rpc("get_seller_indicators", {
      p_period: data.period,
      // Generated RPC types omit SQL nullability; null means the user's full permitted scope.
      p_seller_id: data.seller_id as string,
    });
    if (error) throw new Error(error.message);
    if (!indicators) throw new Error("Não foi possível carregar os indicadores");
    return indicators as unknown as Indicators;
  });

/** generate-indicator-insight: leitura analítica dos indicadores pela IA, gravada em indicator_insights. */
export const generateIndicatorInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { period: string; seller_id: string | null }) => {
    if (!/^\d{4}-\d{2}$/.test(d?.period ?? "")) throw new Error("Período inválido");
    return { period: d.period, seller_id: d.seller_id || null };
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: me } = await sb.from("profiles").select("role, organization_id").eq("id", context.userId).single();
    if (!me) throw new Error("Perfil não encontrado");
    const scope = insightScope(me.role, context.userId, data.seller_id);
    // RPC roda com as regras de acesso do usuário: valida o escopo.
    const { data: ind, error } = await sb.rpc("get_seller_indicators", { p_seller_id: data.seller_id as string, p_period: data.period });
    if (error) throw new Error(error.message);
    const m = ind as unknown as Indicators;
    const snapshot = { meta: m.meta, vendas_mes: m.vendas_mes, ticket_medio: m.ticket_medio, pedidos_count: m.pedidos_count };

    const { generateStructured } = await import("./ai.server");
    let text: string;
    try {
      const out = await generateStructured(
        z.object({ insight_text: z.string() }),
        "Você é um analista comercial de uma distribuidora. Escreva em português, em 2 a 4 frases curtas, uma leitura dos indicadores do mês (meta, vendas, ticket médio, ritmo diário) e uma recomendação prática. Não invente números além dos informados. Se não houver meta ou vendas, diga isso e sugira cadastrar metas ou importar a base.",
        JSON.stringify({ periodo: data.period, escopo: scope.scope, ...snapshot, vendas_por_dia: m.daily }),
      );
      text = out.insight_text;
    } catch (e) {
      console.error("generate-indicator-insight", e);
      throw new Error("Não foi possível gerar a análise agora");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: insErr } = await supabaseAdmin
      .from("indicator_insights")
      .insert({ organization_id: me.organization_id, ...scope, period: data.period, insight_text: text, metrics_snapshot: snapshot })
      .select("insight_text, generated_at")
      .single();
    if (insErr) console.error("indicator_insights insert", insErr);
    return row ?? { insight_text: text, generated_at: new Date().toISOString() };
  });
