import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Envia o pré-cadastro do cliente ao ERP (endereço em Integrações › ERP). O ERP completa o cadastro. */
export const sendCustomerToErp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { customer_id: string }) => {
    if (typeof input?.customer_id !== "string" || !input.customer_id) throw new Error("Cliente inválido");
    return { customer_id: input.customer_id };
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: c } = await sb.from("customers")
      .select("id, name, cnpj_cpf, email, phone, address, notes, owner_id, registration_status")
      .eq("id", data.customer_id).maybeSingle();
    if (!c) throw new Error("Cliente não encontrado");
    if (c.registration_status !== "pre_cadastro") return { ok: true, message: "Cliente já tem cadastro completo no ERP" };

    const { data: cfg } = await sb.from("integration_configs").select("credentials").eq("integration_type", "erp").eq("is_active", true).maybeSingle();
    const creds = (cfg?.credentials ?? {}) as { customer_url?: string; api_key?: string };
    if (!creds.customer_url) {
      await sb.from("customers").update({ erp_sync_status: "erro" }).eq("id", c.id);
      return { ok: false, message: "Endereço de pré-cadastro do ERP ainda não configurado em Integrações" };
    }
    let ok = false;
    try {
      const token = creds.api_key || process.env["ERP_API_KEY"];
      const { postPreRegistration } = await import("./erp-customer-payload");
      ok = await postPreRegistration(creds.customer_url, token, c);
    } catch (e) {
      console.error("send-customer-to-erp", e);
    }
    await sb.from("customers").update(ok ? { erp_sync_status: "enviado", erp_sent_at: new Date().toISOString() } : { erp_sync_status: "erro" }).eq("id", c.id);
    return { ok, message: ok ? "Pré-cadastro enviado ao ERP" : "O ERP não recebeu o pré-cadastro. Tente reenviar." };
  });
