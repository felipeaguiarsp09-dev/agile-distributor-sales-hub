/** Envio de pedidos no formato da API v2 do Tiny (pedido.incluir.php). */
export const TINY_ORDER_URL = "https://api.tiny.com.br/api2/pedido.incluir.php";
export const TINY_SEARCH_URL = "https://api.tiny.com.br/api2/pedidos.pesquisa.php";
export const TINY_TIMEOUT_MS = 15000;

export type TinyOrderSource = {
  id: string;
  created_at: string;
  discount_amount?: number | null;
  payment_method?: string | null;
  payment_days?: number | null;
  notes?: string | null;
  payment_method_name?: string | null;
  customers?: { external_id?: string | null; name?: string | null; cnpj_cpf?: string | null } | null;
  order_items?: Array<{ quantity: number; unit_price: number; products?: { sku?: string | null; name?: string | null; external_id?: string | null } | null }>;
};

// Códigos de forma_pagamento do Tiny. "dinheiro" e "credito" aparecem nos exemplos oficiais
// de pedido.incluir; os demais seguem a tabela de formas de pagamento e devem ser conferidos
// na conta antes de ligar o envio. O nome da forma sempre vai também em meio_pagamento.
export const TINY_PAYMENT_CONFIRMED = new Set(["dinheiro", "credito"]);
export const TINY_PAYMENT: Record<string, string> = {
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
        nome: (c.name ?? "").slice(0, 30), // limite do Tiny: 30 caracteres
        ...(c.cnpj_cpf ? { cpf_cnpj: c.cnpj_cpf.replace(/\D/g, "") } : {}),
        atualizar_cliente: "N",
      },
      itens: (o.order_items ?? []).map((i) => ({
        item: {
          ...(i.products?.external_id ? { id_produto: String(i.products.external_id) } : {}),
          codigo: i.products?.sku ?? "",
          descricao: i.products?.name ?? "",
          unidade: "UN",
          quantidade: String(i.quantity),
          valor_unitario: Number(i.unit_price).toFixed(2),
        },
      })),
      ...(TINY_PAYMENT[code] ? { forma_pagamento: TINY_PAYMENT[code] } : {}),
      ...(o.payment_method_name || code ? { meio_pagamento: String(o.payment_method_name || code).slice(0, 100) } : {}),
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

/** Procura no Tiny um pedido com a nossa referência. found=null quando a consulta não foi conclusiva. */
export async function findTinyOrder(token: string, orderId: string, fetchImpl: typeof fetch = fetch, timeoutMs = TINY_TIMEOUT_MS): Promise<{ found: boolean | null; erpId: string | null }> {
  try {
    const res = await fetchImpl(TINY_SEARCH_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token, formato: "json", numeroEcommerce: tinyOrderKey(orderId) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const r = ((await res.json().catch(() => null)) as { retorno?: any } | null)?.retorno;
    if (r?.status === "OK") {
      const hit = (r.pedidos ?? []).map((x: any) => x?.pedido).find((p: any) => p?.numero_ecommerce === tinyOrderKey(orderId));
      if (hit) return { found: true, erpId: String(hit.numero ?? hit.id) };
      return { found: false, erpId: null };
    }
    if (String(r?.codigo_erro) === "20") return { found: false, erpId: null }; // consulta sem registros
    return { found: null, erpId: null };
  } catch {
    return { found: null, erpId: null };
  }
}

export type TinySendOutcome =
  | { status: "enviado" | "ja_existia"; erpId: string | null }
  | { status: "erro"; erpId: null; error: string };

/**
 * Envio seguro contra duplicidade, sem presumir que o Tiny recusa reenvios:
 * 1) consulta pela referência antes de enviar; se já existe, usa esse pedido;
 * 2) se a consulta não for conclusiva, não envia (evita duplicar);
 * 3) se o envio falhar sem resposta clara ou vier "duplicado", consulta de novo e só aceita se achar.
 */
export async function sendOrderToTiny(token: string, o: TinyOrderSource, fetchImpl: typeof fetch = fetch, timeoutMs = TINY_TIMEOUT_MS): Promise<TinySendOutcome> {
  const before = await findTinyOrder(token, o.id, fetchImpl, timeoutMs);
  if (before.found) return { status: "ja_existia", erpId: before.erpId };
  if (before.found === null) return { status: "erro", erpId: null, error: "Não foi possível conferir no Tiny se o pedido já existe" };

  let r: TinyResult | null = null;
  try {
    r = await postOrderToTiny(token, o, fetchImpl, timeoutMs);
  } catch {
    r = null; // tempo esgotado ou rede: o Tiny pode ter gravado
  }
  if (r?.ok) return { status: "enviado", erpId: r.erpId };
  if (r && !r.duplicate && r.error !== "Resposta inválida do Tiny") return { status: "erro", erpId: null, error: r.error ?? "Erro do Tiny" };

  const after = await findTinyOrder(token, o.id, fetchImpl, timeoutMs);
  if (after.found) return { status: "ja_existia", erpId: after.erpId };
  return { status: "erro", erpId: null, error: r?.duplicate ? "O Tiny indicou duplicidade, mas o pedido não foi encontrado" : "Sem confirmação do Tiny; o pedido não foi encontrado" };
}
