ALTER TABLE public.sales_targets ADD COLUMN customer_target integer;
ALTER TABLE public.sales_targets ADD CONSTRAINT sales_targets_customer_target_nonnegative CHECK (customer_target >= 0);
COMMENT ON COLUMN public.sales_targets.customer_target IS 'Monthly distinct purchasing-customer target; NULL means not defined.';
CREATE OR REPLACE FUNCTION public.get_seller_indicators(p_seller_id uuid, p_period text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $function$
DECLARE me record; v_start timestamptz; v_end timestamptz; v_sellers uuid[]; v_meta numeric; v_vendas numeric; v_count int; v_daily jsonb; v_customers int; v_customer_target int; v_visits int;
BEGIN
 SELECT * INTO me FROM public.current_profile();
 IF me.profile_id IS NULL OR me.role = 'cliente' THEN RAISE EXCEPTION 'Sem acesso aos indicadores'; END IF;
 IF p_period !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Período inválido'; END IF;
 v_start := (p_period || '-01')::date; v_end := v_start + interval '1 month';
 IF me.role = 'vendedor' THEN
  IF p_seller_id IS NOT NULL AND p_seller_id <> me.profile_id THEN RAISE EXCEPTION 'Vendedor só consulta os próprios números'; END IF;
  v_sellers := ARRAY[me.profile_id];
 ELSIF me.role = 'supervisor' THEN
  SELECT array_agg(id) INTO v_sellers FROM public.profiles WHERE supervisor_id = me.profile_id AND organization_id = me.organization_id;
  IF p_seller_id IS NOT NULL THEN
   IF NOT (p_seller_id = ANY(coalesce(v_sellers, '{}'))) THEN RAISE EXCEPTION 'Vendedor fora da sua equipe'; END IF;
   v_sellers := ARRAY[p_seller_id];
  END IF;
 ELSE
  IF p_seller_id IS NOT NULL THEN v_sellers := ARRAY[p_seller_id];
  ELSE SELECT array_agg(id) INTO v_sellers FROM public.profiles WHERE organization_id = me.organization_id; END IF;
 END IF;
 v_sellers := coalesce(v_sellers, '{}');
 SELECT coalesce(sum(target_amount),0), sum(customer_target) INTO v_meta, v_customer_target FROM public.sales_targets
 WHERE organization_id=me.organization_id AND period=p_period AND seller_id=ANY(v_sellers);
 SELECT coalesce(sum(total_amount),0), count(*), count(DISTINCT customer_id) INTO v_vendas,v_count,v_customers FROM public.orders
 WHERE organization_id=me.organization_id AND status IN ('aprovado','faturado') AND created_at>=v_start AND created_at<v_end
 AND (seller_id=ANY(v_sellers) OR (p_seller_id IS NULL AND me.role='administrador'));
 SELECT coalesce(jsonb_agg(jsonb_build_object('day',d,'total',t) ORDER BY d),'[]') INTO v_daily FROM (
 SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS d,sum(total_amount) AS t FROM public.orders
 WHERE organization_id=me.organization_id AND status IN ('aprovado','faturado') AND created_at>=v_start AND created_at<v_end
 AND (seller_id=ANY(v_sellers) OR (p_seller_id IS NULL AND me.role='administrador')) GROUP BY 1) x;
 SELECT count(*) INTO v_visits FROM public.agenda_visits WHERE organization_id=me.organization_id AND status='realizada'
 AND check_in_at>=v_start AND check_in_at<v_end AND seller_id=ANY(v_sellers);
 RETURN jsonb_build_object('meta',v_meta,'vendas_mes',v_vendas,'ticket_medio',CASE WHEN v_count>0 THEN round(v_vendas/v_count,2) ELSE 0 END,
 'pedidos_count',v_count,'daily',v_daily,'clientes_atendidos',v_customers,'meta_clientes',v_customer_target,
 'clientes_a_atender',CASE WHEN v_customer_target IS NULL THEN NULL ELSE greatest(v_customer_target-v_customers,0) END,'visitas_realizadas',v_visits);
END; $function$;
CREATE OR REPLACE FUNCTION public.validate_sales_target_scope() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE me record;
BEGIN
 IF auth.role()='service_role' THEN RETURN NEW; END IF;
 SELECT * INTO me FROM public.current_profile();
 IF me.profile_id IS NULL OR NEW.organization_id<>me.organization_id OR NOT (
 me.role='administrador' OR (me.role='supervisor' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=NEW.seller_id AND p.supervisor_id=me.profile_id AND p.organization_id=me.organization_id)))
 THEN RAISE EXCEPTION 'Sem permissão para definir metas deste vendedor'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER validate_sales_target_scope BEFORE INSERT OR UPDATE ON public.sales_targets FOR EACH ROW EXECUTE FUNCTION public.validate_sales_target_scope();