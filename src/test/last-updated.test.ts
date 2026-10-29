import { describe, expect, it } from "vitest";
import { lastUpdatedLabel } from "@/lib/indicators";

describe("lastUpdatedLabel", () => {
  it("formata o horário da última atualização em pt-BR", () => {
    // 14:32 no fuso local — o rótulo deve mostrar exatamente essa hora.
    const ts = new Date(2026, 9, 29, 14, 32).getTime();
    expect(lastUpdatedLabel(ts)).toBe("Atualizado às 14:32");
  });

  it("não mostra rótulo quando ainda não houve leitura", () => {
    expect(lastUpdatedLabel(undefined)).toBeNull();
    expect(lastUpdatedLabel(0)).toBeNull();
  });
});
