import type { ParsedLocation } from "@tanstack/react-router";
import { orderListSearch } from "@/lib/orders";

/** Share the list's position across history entries, but never across filters/pages. */
export function getAppScrollRestorationKey(location: ParsedLocation) {
  if (location.pathname.replace(/\/$/, "") === "/pedidos") {
    return `orders:${JSON.stringify(orderListSearch(location.search))}`;
  }
  return location.state.__TSR_key || location.href;
}