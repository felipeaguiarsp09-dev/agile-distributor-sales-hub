import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(sb: any, userId: string) {
  const { data: me } = await sb.from("profiles").select("id, role, organization_id").eq("id", userId).single();
  if (!me || me.role !== "administrador") throw new Error("Apenas o administrador");
  return me as { id: string; role: string; organization_id: string };
}

/** sync-erp-stock (manual, pela tela Integrações). */
export const syncErpStockNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await requireAdmin(context.supabase, context.userId);
    const { syncErpStock } = await import("./erp-stock.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return syncErpStock(supabaseAdmin, me.organization_id);
  });

const ROLES = ["vendedor", "supervisor", "administrador", "cliente"] as const;
type Invite = { email: string; full_name: string; role: (typeof ROLES)[number]; supervisor_id: string | null; customer_id: string | null };

/** Convida um novo usuário por email e define papel/equipe (só administrador). */
export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Invite) => {
    const email = String(d?.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 255) throw new Error("Email inválido");
    if (!ROLES.includes(d.role)) throw new Error("Papel inválido");
    const full_name = String(d.full_name ?? "").trim().slice(0, 120);
    if (!full_name) throw new Error("Informe o nome");
    if (d.role === "cliente" && !d.customer_id) throw new Error("Escolha o cadastro do cliente");
    return { ...d, email, full_name };
  })
  .handler(async ({ data, context }) => {
    const me = await requireAdmin(context.supabase, context.userId);
    if (data.customer_id) {
      const { data: c } = await context.supabase.from("customers").select("id, portal_user_id").eq("id", data.customer_id).maybeSingle();
      if (!c) throw new Error("Cliente não encontrado");
      if (c.portal_user_id) throw new Error("Este cliente já tem login");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const origin = new URL(getRequest().url).origin;
    const { data: inv, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.full_name },
      redirectTo: `${origin}/reset-password`,
    });
    if (error || !inv.user) throw new Error(error?.message.includes("already") ? "Já existe um usuário com este email" : "Não foi possível enviar o convite");
    const uid = inv.user.id;
    await supabaseAdmin.from("profiles").update({
      full_name: data.full_name, role: data.role, organization_id: me.organization_id,
      supervisor_id: data.role === "vendedor" ? data.supervisor_id : null,
    }).eq("id", uid);
    if (data.customer_id) await supabaseAdmin.from("customers").update({ portal_user_id: uid }).eq("id", data.customer_id);
    return { ok: true, user_id: uid };
  });

/** Teste somente leitura do acesso ao Tiny (API v2 info.php): não cria nem altera nada. */
export const testTinyAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const token = process.env.TINY_API_TOKEN;
    if (!token) return { ok: false, message: "Chave do Tiny ainda não configurada." };
    try {
      const body = new URLSearchParams({ token, formato: "json" });
      const res = await fetch("https://api.tiny.com.br/api2/info.php", {
        method: "POST", body, signal: AbortSignal.timeout(15000),
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
      const json: any = await res.json().catch(() => null);
      const r = json?.retorno;
      if (r?.status === "OK") {
        const conta = r.conta ?? {};
        return { ok: true, message: `Acesso confirmado${conta.razao_social ? ` · ${conta.razao_social}` : ""}.` };
      }
      const err = r?.erros?.[0]?.erro ?? `HTTP ${res.status}`;
      return { ok: false, message: `O Tiny recusou o acesso: ${String(err).slice(0, 200)}` };
    } catch {
      return { ok: false, message: "Não foi possível falar com o Tiny (tempo esgotado ou rede)." };
    }
  });
