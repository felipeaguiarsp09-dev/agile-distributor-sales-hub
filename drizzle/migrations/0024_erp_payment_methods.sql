CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  requires_days boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_methods_select ON public.payment_methods FOR SELECT TO authenticated
  USING (organization_id = (select organization_id from public.current_profile()));
CREATE POLICY payment_methods_admin_write ON public.payment_methods FOR ALL TO authenticated
  USING (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador')
  WITH CHECK (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador');

-- Lista inicial (igual à atual) até o ERP enviar a sua; a importação do ERP sobrescreve.
INSERT INTO public.payment_methods (organization_id, code, name, requires_days)
SELECT o.id, v.code, v.name, v.code = 'boleto'
FROM public.organizations o CROSS JOIN (VALUES
 ('dinheiro','Dinheiro'),('cartao_credito','Cartão de crédito'),('cartao_debito','Cartão de débito'),('boleto','Boleto'),
 ('cheque','Cheque'),('deposito','Depósito'),('bonificacao','Bonificação'),('multiplas','Múltiplas')) v(code,name)
ON CONFLICT DO NOTHING;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.import_jobs DROP CONSTRAINT IF EXISTS import_jobs_entity_type_check;
ALTER TABLE public.import_jobs ADD CONSTRAINT import_jobs_entity_type_check CHECK (entity_type in ('customers','products','orders','payment_methods'));