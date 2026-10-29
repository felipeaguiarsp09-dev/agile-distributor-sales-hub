import { describe, expect, it } from "vitest";
import { parseCountTarget } from "@/lib/monthly-targets";
describe("monthly count goals", () => {
  it("accepts whole monthly customer and visit counts", () => {
    expect(parseCountTarget("20")).toBe(20);
    expect(parseCountTarget("30")).toBe(30);
    expect(parseCountTarget("0")).toBe(0);
  });
  it("keeps an unset goal distinct from zero", () => { expect(parseCountTarget("")).toBeNull(); });
  it("rejects negative and fractional goals", () => {
    expect(() => parseCountTarget("-1")).toThrow();
    expect(() => parseCountTarget("1.5")).toThrow();
  });
});