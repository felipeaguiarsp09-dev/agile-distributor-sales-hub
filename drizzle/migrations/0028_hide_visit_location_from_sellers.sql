REVOKE SELECT ON public.agenda_visits FROM authenticated, anon;
GRANT SELECT (id, organization_id, seller_id, customer_id, scheduled_at, status, check_in_at, notes, created_at, updated_at) ON public.agenda_visits TO authenticated;

CREATE OR REPLACE FUNCTION public.visit_check_in_locations(p_from timestamptz, p_to timestamptz)
RETURNS TABLE(id uuid, check_in_lat double precision, check_in_lng double precision, check_in_accuracy_m double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.id, v.check_in_lat::double precision, v.check_in_lng::double precision, v.check_in_accuracy_m::double precision
  FROM public.agenda_visits v, public.current_profile() p
  WHERE v.scheduled_at >= p_from AND v.scheduled_at < p_to
    AND v.organization_id = p.organization_id
    AND (p.role = 'administrador'
      OR (p.role = 'supervisor' AND v.seller_id IN (SELECT pr.id FROM public.profiles pr WHERE pr.supervisor_id = auth.uid())))
$$;
REVOKE ALL ON FUNCTION public.visit_check_in_locations(timestamptz, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.visit_check_in_locations(timestamptz, timestamptz) TO authenticated;