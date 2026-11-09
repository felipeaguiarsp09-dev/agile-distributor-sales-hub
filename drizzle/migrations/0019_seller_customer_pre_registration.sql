DROP POLICY IF EXISTS customers_insert ON public.customers;
CREATE POLICY customers_insert ON public.customers FOR INSERT TO authenticated WITH CHECK (
  organization_id = (SELECT cp.organization_id FROM public.current_profile() cp)
  AND (
    (SELECT cp.role FROM public.current_profile() cp) = 'administrador'
    OR ((SELECT cp.role FROM public.current_profile() cp) = 'vendedor' AND owner_id = auth.uid() AND external_id IS NULL AND portal_user_id IS NULL)
  )
);

DROP POLICY IF EXISTS customers_update ON public.customers;
CREATE POLICY customers_update ON public.customers FOR UPDATE TO authenticated
USING (
  organization_id = (SELECT cp.organization_id FROM public.current_profile() cp)
  AND ((SELECT cp.role FROM public.current_profile() cp) = 'administrador'
       OR ((SELECT cp.role FROM public.current_profile() cp) = 'vendedor' AND owner_id = auth.uid()))
)
WITH CHECK (
  organization_id = (SELECT cp.organization_id FROM public.current_profile() cp)
  AND ((SELECT cp.role FROM public.current_profile() cp) = 'administrador'
       OR ((SELECT cp.role FROM public.current_profile() cp) = 'vendedor' AND owner_id = auth.uid()))
);

CREATE OR REPLACE FUNCTION public.protect_customer_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_role text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  SELECT role INTO v_role FROM public.current_profile();
  IF v_role = 'administrador' THEN RETURN NEW; END IF;
  IF NEW.external_id IS DISTINCT FROM OLD.external_id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.portal_user_id IS DISTINCT FROM OLD.portal_user_id OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Alteração não permitida neste cliente';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_customer_fields ON public.customers;
CREATE TRIGGER protect_customer_fields BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.protect_customer_fields();