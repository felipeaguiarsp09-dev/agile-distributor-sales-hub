type Addr = Record<string, string | undefined> | null | undefined;

export interface PreRegistrationCustomer {
  id: string;
  name: string;
  cnpj_cpf: string | null;
  email: string | null;
  phone: string | null;
  address: unknown;
  notes: string | null;
  owner_id: string | null;
}

/** JSON enviado ao ERP no pré-cadastro: cidade, UF e CEP também vão como campos próprios. */
export function buildPreRegistrationPayload(c: PreRegistrationCustomer) {
  const a = (c.address && typeof c.address === "object" ? c.address : {}) as Addr & object;
  const s = (k: string) => {
    const v = (a as Record<string, unknown>)[k];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  return {
    tipo: "pre_cadastro",
    idempotency_key: preRegistrationKey(c.id),
    id: c.id,
    name: c.name,
    cnpj_cpf: c.cnpj_cpf,
    email: c.email,
    phone: c.phone,
    address: c.address ?? null,
    city: s("city"),
    state: s("state")?.toUpperCase() ?? null,
    zip: s("zip")?.replace(/\D/g, "") || null,
    notes: c.notes,
    owner_id: c.owner_id,
  };
}

/** Chave estável por cliente: reenvios do mesmo pré-cadastro repetem a mesma chave. */
export const preRegistrationKey = (customerId: string) => `pre-cadastro-${customerId}`;
export const ERP_PRE_REGISTRATION_TIMEOUT_MS = 15000;

export async function postPreRegistration(
  url: string,
  token: string | undefined,
  c: PreRegistrationCustomer,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = ERP_PRE_REGISTRATION_TIMEOUT_MS,
) {
  const res = await fetchImpl(url, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "content-type": "application/json",
      "idempotency-key": preRegistrationKey(c.id),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(buildPreRegistrationPayload(c)),
  });
  return res.ok;
}
