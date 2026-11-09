CREATE OR REPLACE FUNCTION public.prevent_duplicate_daily_check_in()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_day date;
BEGIN
  IF NEW.check_in_at IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.check_in_at IS NOT DISTINCT FROM OLD.check_in_at AND NEW.customer_id IS NOT DISTINCT FROM OLD.customer_id AND NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id THEN RETURN NEW; END IF;
  END IF;
  -- Serialize check-ins for this customer, including simultaneous requests.
  PERFORM 1 FROM public.customers WHERE id = NEW.customer_id FOR UPDATE;
  v_day := (NEW.check_in_at AT TIME ZONE 'America/Sao_Paulo')::date;
  IF EXISTS (
    SELECT 1 FROM public.agenda_visits v
    WHERE v.organization_id = NEW.organization_id AND v.customer_id = NEW.customer_id
      AND v.id IS DISTINCT FROM NEW.id
      AND v.check_in_at >= (v_day::timestamp AT TIME ZONE 'America/Sao_Paulo')
      AND v.check_in_at < ((v_day + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Já existe um check-in neste cliente hoje. Só é permitido um check-in por cliente por dia.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.prevent_duplicate_daily_check_in() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_agenda_daily_customer_check_in BEFORE INSERT OR UPDATE OF check_in_at, customer_id, organization_id ON public.agenda_visits FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_daily_check_in();
CREATE INDEX IF NOT EXISTS agenda_customer_check_in_lookup ON public.agenda_visits (organization_id, customer_id, check_in_at) WHERE check_in_at IS NOT NULL;