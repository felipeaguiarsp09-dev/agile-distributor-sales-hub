ALTER TABLE public.customers
  ADD COLUMN registration_status text NOT NULL DEFAULT 'completo' CHECK (registration_status IN ('pre_cadastro','completo')),
  ADD COLUMN notes text,
  ADD COLUMN erp_sync_status text CHECK (erp_sync_status IN ('pendente','enviado','erro')),
  ADD COLUMN erp_sent_at timestamptz;

-- Cadastro feito no app (sem código do ERP) é pré-cadastro; crédito vem só do ERP.
CREATE OR REPLACE FUNCTION public.customer_pre_registration()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.external_id IS NULL THEN
      NEW.registration_status := 'pre_cadastro';
      NEW.erp_sync_status := 'pendente';
      NEW.credit_limit := 0;
      NEW.credit_status := 'bloqueado';
    ELSE
      NEW.registration_status := 'completo';
    END IF;
  ELSE
    IF NEW.external_id IS NOT NULL AND OLD.external_id IS NULL THEN
      NEW.registration_status := 'completo';
    ELSIF auth.uid() IS NOT NULL AND NEW.external_id IS NULL THEN
      -- antes do ERP, o app não define crédito
      NEW.credit_limit := OLD.credit_limit;
      NEW.credit_status := OLD.credit_status;
      NEW.registration_status := OLD.registration_status;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER customer_pre_registration BEFORE INSERT OR UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.customer_pre_registration();

-- Pedido só para cliente com cadastro completo no ERP.
CREATE OR REPLACE FUNCTION public.block_orders_pre_registration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.customers WHERE id = NEW.customer_id AND registration_status = 'pre_cadastro') THEN
    RAISE EXCEPTION 'Cliente em pré-cadastro: aguarde o cadastro completo no ERP para fazer pedidos';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER block_orders_pre_registration BEFORE INSERT OR UPDATE OF customer_id ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.block_orders_pre_registration();