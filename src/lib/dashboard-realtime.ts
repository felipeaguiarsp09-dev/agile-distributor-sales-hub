import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";

// Events are only a doorbell. Authenticated RPCs remain the source of data and
// enforce seller/team isolation; month and seller stay in each query's key.
export function subscribeDashboardOrders(
  client: Pick<SupabaseClient, "channel" | "removeChannel">,
  queryClient: QueryClient,
  profileId: string,
) {
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["indicators", profileId] });
    void queryClient.invalidateQueries({ queryKey: ["unserved-customers", profileId] });
  };
  const channel = client
    .channel(`dashboard-orders-${crypto.randomUUID()}`)
    // All changes also cover reversals, customer/date edits and imports. RLS
    // limits delivery. Active queries refetch; other months are marked stale.
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refresh)
    .subscribe((status) => {
      // Close the first-read race and catch changes missed while disconnected.
      if (status === "SUBSCRIBED") refresh();
    });

  return () => { void client.removeChannel(channel); };
}