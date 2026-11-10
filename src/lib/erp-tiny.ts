/** Envio de pedidos no formato da API v2 do Tiny (pedido.incluir.php). */
export const TINY_ORDER_URL = "https://api.tiny.com.br/api2/pedido.incluir.php";
export const TINY_TIMEOUT_MS = 15000;

export type TinyOrderSource = {
  id: string;
  created_at: string;
  discount_amount?: number | null;
  payment_method?: string | null;
  payment_days?: number | null;
  notes?: string | null;
  customers?: { external_id?: string | null; name?: string | null; cnpj_cpf?: string | null } | null;
  order_items?: Array<{ quantity: number; unit_price: number; products?: { sku?: string | null; name?: string | null } | null }>;
};

// Códigos de forma de pagamento aceitos pelo Tiny.
const TINY_PAYMENT: Record<string, string> = {
  dinheiro: "dinheiro",
  cartao_credito: "credito",
  cartao_debito: "debito",
  boleto: "boleto",
  cheque: "cheque",
  deposito: "deposito",
  bonificacao: "bonificacao",
  multiplas: "multiplas",
};

/** Chave estável enviada como número do pedido no e-commerce: o Tiny recusa a repetição. */
export const tinyOrderKey = (id: string) => `pedido-${id}`;

function dateBR(iso: string) {
  const d = new Date(new Date(iso).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function buildTinyOrder(o: TinyOrderSource) {
  const c = o.customers ?? {};
  const code = o.payment_method ?? "";
  const obs = [o.notes?.trim(), code && !TINY_PAYMENT[code] ? `Forma de pagamento: ${code}` : null, o.payment_days ? `Prazo: ${o.payment_days} dias` : null]
    .filter(Boolean)
    .join(" · ");
  return {
    pedido: {
      data_pedido: dateBR(o.created_at),
      numero_pedido_ecommerce: tinyOrderKey(o.id),
      cliente: {
        ...(c.external_id ? { codigo: c.external_id } : {}),
        nome: c.name ?? "",
        ...(c.cnpj_cpf ? { cpf_cnpj: c.cnpj_cpf.replace(/\D/g, "") } : {}),
        atualizar_cliente: "N",
      },
      itens: (o.order_items ?? []).map((i) => ({
        item: {
          codigo: i.products?.sku ?? "",
          descricao: i.products?.name ?? "",
          unidade: "UN",
          quantidade: String(i.quantity),
          valor_unitario: Number(i.unit_price).toFixed(2),
        },
      })),
      ...(TINY_PAYMENT[code] ? { forma_pagamento: TINY_PAYMENT[code] } : {}),
      ...(Number(o.discount_amount) > 0 ? { valor_desconto: Number(o.discount_amount).toFixed(2) } : {}),
      ...(obs ? { obs } : {}),
    },
  };
}

export type TinyResult = { ok: boolean; erpId: string | null; duplicate?: boolean; error?: string };

/** Interpreta a resposta do Tiny: número do pedido, duplicidade ou erro. */
export function parseTinyResponse(json: unknown): TinyResult {
  const r = (json as { retorno?: any })?.retorno;
  const reg = r?.registros?.[0]?.registro ?? r?.registros?.registro;
  if (r?.status === "OK" && reg?.status !== "Erro") {
    const n = reg?.numero ?? reg?.id;
    return { ok: true, erpId: n != null ? String(n) : null };
  }
  const errs: string[] = [...(r?.erros ?? []), ...(reg?.erros ?? [])].map((e: any) => String(e?.erro ?? e)).filter(Boolean);
  const msg = errs.join("; ") || "Resposta inválida do Tiny";
  const duplicate = String(reg?.codigo_erro ?? r?.codigo_erro) === "30" || /duplic|já existe/i.test(msg);
  return { ok: false, erpId: null, duplicate, error: msg.slice(0, 300) };
}

export async function postOrderToTiny(token: string, o: TinyOrderSource, fetchImpl: typeof fetch = fetch, timeoutMs = TINY_TIMEOUT_MS): Promise<TinyResult> {
  const body = new URLSearchParams({ token, formato: "json", pedido: JSON.stringify(buildTinyOrder(o)) });
  const res = await fetchImpl(TINY_ORDER_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  return parseTinyResponse(await res.json().catch(() => null));
}
