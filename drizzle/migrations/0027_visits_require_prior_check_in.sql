CREATE OR REPLACE FUNCTION public.require_prior_visit_check_in()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'realizada' THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Faça o check-in antes de registrar a visita.';
    ELSIF OLD.status IS DISTINCT FROM 'realizada' AND (OLD.check_in_at IS NULL OR NEW.check_in_at IS NULL) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Faça o check-in antes de registrar a visita.';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.check_in_at IS NOT NULL THEN
    IF NEW.check_in_at IS DISTINCT FROM OLD.check_in_at OR NEW.check_in_lat IS DISTINCT FROM OLD.check_in_lat OR NEW.check_in_lng IS DISTINCT FROM OLD.check_in_lng OR NEW.check_in_accuracy_m IS DISTINCT FROM OLD.check_in_accuracy_m OR NEW.customer_id IS DISTINCT FROM OLD.customer_id OR NEW.seller_id IS DISTINCT FROM OLD.seller_id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'O check-in registrado não pode ser alterado.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.require_prior_visit_check_in() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_visits_require_prior_check_in BEFORE INSERT OR UPDATE ON public.agenda_visits FOR EACH ROW EXECUTE FUNCTION public.require_prior_visit_check_in();