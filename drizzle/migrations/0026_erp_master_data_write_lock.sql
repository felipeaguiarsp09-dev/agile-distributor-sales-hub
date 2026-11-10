CREATE OR REPLACE FUNCTION public.erp_master_data_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  allowed_changes text[] := ARRAY['erp_sync_status','erp_sent_at','portal_user_id','updated_at','name_search'];
  k text;
BEGIN
  -- ERP import/sync (service role) and internal security-definer routines (postgres) are authorized.
  IF current_user NOT IN ('authenticated','anon') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME IN ('products','payment_methods') THEN
    RAISE EXCEPTION 'Cadastro controlado pelo ERP: alterações locais não são permitidas' USING ERRCODE = '42501';
  END IF;

  -- customers: only local pre-registrations may be created/edited/removed; ERP records only accept status/portal link fields.
  IF TG_OP = 'INSERT' THEN
    IF NEW.registration_status <> 'pre_cadastro' THEN
      RAISE EXCEPTION 'Clientes completos vêm do ERP; crie apenas pré-cadastros' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.registration_status <> 'pre_cadastro' THEN
      RAISE EXCEPTION 'Cadastro controlado pelo ERP: exclusão local não permitida' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.registration_status = 'pre_cadastro' AND NEW.registration_status = 'pre_cadastro' THEN
    RETURN NEW;
  END IF;
  FOR k IN SELECT key FROM jsonb_each(to_jsonb(NEW)) LOOP
    IF NOT (k = ANY(allowed_changes)) AND (to_jsonb(NEW)->k) IS DISTINCT FROM (to_jsonb(OLD)->k) THEN
      RAISE EXCEPTION 'Cadastro controlado pelo ERP: campo % não pode ser alterado localmente', k USING ERRCODE = '42501';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS erp_master_data_guard ON public.products;
CREATE TRIGGER erp_master_data_guard BEFORE INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.erp_master_data_guard();
DROP TRIGGER IF EXISTS erp_master_data_guard ON public.payment_methods;
CREATE TRIGGER erp_master_data_guard BEFORE INSERT OR UPDATE OR DELETE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.erp_master_data_guard();
DROP TRIGGER IF EXISTS erp_master_data_guard ON public.customers;
CREATE TRIGGER erp_master_data_guard BEFORE INSERT OR UPDATE OR DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.erp_master_data_guard();