import { describe, it, expect, vi } from "vitest";
import { buildPreRegistrationPayload, postPreRegistration } from "./erp-customer-payload";

const customer = {
  id: "c1", name: "Mercado Simulado", cnpj_cpf: "12345678000190", email: "a@b.com", phone: "11999999999",
  address: { street: "Rua A, 10", city: " São Paulo ", state: "sp", zip: "01310-100" },
  notes: "obs", owner_id: "v1",
};

describe("pré-cadastro para o ERP", () => {
  it("envia cidade, UF e CEP como campos próprios", () => {
    const p = buildPreRegistrationPayload(customer);
    expect(p.city).toBe("São Paulo");
    expect(p.state).toBe("SP");
    expect(p.zip).toBe("01310100");
    expect(p.tipo).toBe("pre_cadastro");
  });

  it("usa null quando cidade, UF e CEP estão vazios", () => {
    const p = buildPreRegistrationPayload({ ...customer, address: null });
    expect([p.city, p.state, p.zip]).toEqual([null, null, null]);
  });

  it("faz POST JSON com Bearer para o ERP simulado", async () => {
    const fake = vi.fn(async () => new Response("{}", { status: 201 }));
    const ok = await postPreRegistration("https://erp.simulado/clientes", "chave", customer, fake as unknown as typeof fetch);
    expect(ok).toBe(true);
    const [url, init] = fake.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://erp.simulado/clientes");
    expect((init.headers as Record<string, string>)["authorization"]).toBe("Bearer chave");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ name: "Mercado Simulado", city: "São Paulo", state: "SP", zip: "01310100" });
    console.log(JSON.stringify(body, null, 2));
  });

  it("retorna falha quando o ERP recusa", async () => {
    const fake = vi.fn(async () => new Response("", { status: 500 }));
    expect(await postPreRegistration("https://x", undefined, customer, fake as unknown as typeof fetch)).toBe(false);
  });

  it("reenvio do pré-cadastro repete a mesma Idempotency-Key", async () => {
    const fake = vi.fn(async () => new Response("{}", { status: 200 }));
    await postPreRegistration("https://x", "t", customer, fake as unknown as typeof fetch);
    await postPreRegistration("https://x", "t", customer, fake as unknown as typeof fetch);
    const keys = fake.mock.calls.map((c) => ((c as unknown as [string, RequestInit])[1].headers as Record<string, string>)["idempotency-key"]);
    expect(keys).toEqual(["pre-cadastro-c1", "pre-cadastro-c1"]);
    expect(JSON.parse((fake.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).idempotency_key).toBe("pre-cadastro-c1");
  });
});
