import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canViewCheckInLocation } from "@/lib/agenda";

export const listVisits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { from: string; to: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: profile, error: profileError } = await context.supabase.from("profiles").select("role").eq("id", context.userId).single();
    if (profileError || !profile) throw new Error("Não foi possível verificar o acesso às visitas");
    const { data: visits, error } = await context.supabase.from("agenda_visits")
      .select("id, customer_id, scheduled_at, status, check_in_at, notes, seller_id, customers(name, address), seller:profiles!agenda_visits_seller_id_fkey(full_name)")
      .gte("scheduled_at", data.from).lt("scheduled_at", data.to).order("scheduled_at");
    if (error) throw error;
    if (!canViewCheckInLocation(profile.role)) return visits.map((visit) => ({ ...visit, check_in_lat: null, check_in_lng: null, check_in_accuracy_m: null }));
    const { data: locations, error: locationError } = await context.supabase.from("agenda_visits")
      .select("id, check_in_lat, check_in_lng, check_in_accuracy_m")
      .gte("scheduled_at", data.from).lt("scheduled_at", data.to);
    if (locationError) throw locationError;
    const byId = new Map(locations.map((location) => [location.id, location]));
    return visits.map((visit) => ({ ...visit, ...byId.get(visit.id) }));
  });