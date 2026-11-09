DROP POLICY IF EXISTS agenda_visits_delete ON public.agenda_visits;
CREATE POLICY agenda_visits_delete ON public.agenda_visits FOR DELETE TO authenticated
USING (
  organization_id = (SELECT cp.organization_id FROM public.current_profile() cp)
  AND (seller_id = auth.uid() OR (SELECT cp.role FROM public.current_profile() cp) = 'administrador')
  AND status IN ('planejada','cancelada')
  AND check_in_at IS NULL
);