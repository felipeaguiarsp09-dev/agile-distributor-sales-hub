import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

function provider() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("IA não configurada");
  let runId: string | undefined;
  return createOpenAI({
    baseURL: GATEWAY,
    apiKey: key,
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get("X-Lovable-AIG-Run-ID") ?? undefined;
      return res;
    },
  });
}

/** Gera um objeto estruturado com o modelo padrão do Lovable AI. */
export async function generateStructured<T extends z.ZodTypeAny>(schema: T, system: string, prompt: string): Promise<z.infer<T>> {
  const result = streamText({
    model: provider().responses(MODEL),
    system,
    prompt,
    output: Output.object({ schema }),
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  try {
    return (await result.output) as z.infer<T>;
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e) && e.text) return schema.parse(JSON.parse(e.text));
    throw e;
  }
}
