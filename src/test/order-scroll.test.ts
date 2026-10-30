import type { ParsedLocation } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { getAppScrollRestorationKey } from "@/lib/order-scroll";

function location(pathname: string, search: Record<string, unknown>, key: string): ParsedLocation {
  return { pathname, search, state: { __TSR_key: key, __TSR_index: 0 }, href: pathname, hash: "", searchStr: "" };
}

describe("Orders list scroll restoration", () => {
  it("restores the same list when returning through a new history entry", () => {
    const filters = { q: "emporio", status: "aprovado", origem: "vendedor", de: "2026-10-01", ate: "2026-10-31", pagina: 2 };
    expect(getAppScrollRestorationKey(location("/pedidos", filters, "before")))
      .toBe(getAppScrollRestorationKey(location("/pedidos/", filters, "return")));
  });

  it("keeps separate scroll positions for each page and filter", () => {
    const original = getAppScrollRestorationKey(location("/pedidos", { pagina: 2, status: "aprovado" }, "a"));
    expect(getAppScrollRestorationKey(location("/pedidos", { pagina: 3, status: "aprovado" }, "a"))).not.toBe(original);
    expect(getAppScrollRestorationKey(location("/pedidos", { pagina: 2, status: "cancelado" }, "a"))).not.toBe(original);
  });

  it("preserves native history-entry restoration outside the list", () => {
    expect(getAppScrollRestorationKey(location("/pedidos/order-id", {}, "detail-entry"))).toBe("detail-entry");
  });
});