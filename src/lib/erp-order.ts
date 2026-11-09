/** Envia o pedido ao ERP com chave de idempotência = id do pedido; reenvios repetem a mesma chave. */
export const ERP_TIMEOUT_MS = 15000;

export function erpOrderHeaders(orderId: string, token: string | undefined) {
  return {
    "content-type": "application/json",
    "idempotency-key": `pedido-${orderId}`,
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

export async function postOrderToErp(
  endpoint: string,
  token: string | undefined,
  order: { id: string } & Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = ERP_TIMEOUT_MS,
): Promise<{ ok: boolean; erpId: string | null }> {
  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: erpOrderHeaders(order.id, token),
    body: JSON.stringify({ ...order, idempotency_key: `pedido-${order.id}` }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) return { ok: false, erpId: null };
  const body = (await res.json().catch(() => ({}))) as { erp_order_id?: string; id?: string };
  return { ok: true, erpId: body.erp_order_id ?? body.id ?? null };
}
