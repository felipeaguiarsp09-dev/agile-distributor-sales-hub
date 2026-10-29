import { subMonths } from "date-fns";

/** Rolling 12 calendar months, including the current instant and the lower boundary. */
export function orderHistoryWindow(now = new Date()) {
  return { from: subMonths(now, 12).toISOString(), to: now.toISOString() };
}