ALTER TABLE public.orders DROP CONSTRAINT orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status IN ('rascunho','aguardando_aprovacao','aprovado','recusado','faturado','entregue','cancelado'));
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.get_seller_indicators(p_seller_id uuid, p_period text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
DECLARE me record; v_start timestamptz; v_end timestamptz; v_sellers uuid[]; v_meta numeric; v_vendas numeric; v_count int; v_daily jsonb; v_customers int; v_customer_target int; v_visits int; v_visit_target int; v_atendidos int; v_ativados int;
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
 SELECT coalesce(sum(target_amount),0), sum(customer_target), sum(visit_target) INTO v_meta, v_customer_target, v_visit_target FROM public.sales_targets
 WHERE organization_id=me.organization_id AND period=p_period AND seller_id=ANY(v_sellers);
 CREATE TEMP TABLE IF NOT EXISTS _ind_orders ON COMMIT DROP AS SELECT customer_id, total_amount, created_at FROM public.orders WHERE false;
 TRUNCATE _ind_orders;
 INSERT INTO _ind_orders SELECT customer_id, total_amount, created_at FROM public.orders
 WHERE organization_id=me.organization_id AND status IN ('aprovado','faturado','entregue') AND created_at>=v_start AND created_at<v_end
 AND (seller_id=ANY(v_sellers) OR (p_seller_id IS NULL AND me.role='administrador'));
 SELECT coalesce(sum(total_amount),0), count(*), count(DISTINCT customer_id) INTO v_vendas,v_count,v_customers FROM _ind_orders;
 SELECT coalesce(jsonb_agg(jsonb_build_object('day',d,'total',t) ORDER BY d),'[]') INTO v_daily FROM (
  SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS d,sum(total_amount) AS t FROM _ind_orders GROUP BY 1) x;
 SELECT count(*) INTO v_visits FROM public.agenda_visits WHERE organization_id=me.organization_id AND status='realizada'
 AND check_in_at>=v_start AND check_in_at<v_end AND seller_id=ANY(v_sellers);
 SELECT count(*) INTO v_atendidos FROM (
  SELECT customer_id FROM _ind_orders
  UNION SELECT customer_id FROM public.agenda_visits WHERE organization_id=me.organization_id AND status='realizada'
   AND check_in_at>=v_start AND check_in_at<v_end AND seller_id=ANY(v_sellers)) u;
 SELECT count(DISTINCT t.customer_id) INTO v_ativados FROM _ind_orders t
 WHERE NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.organization_id=me.organization_id AND o.customer_id=t.customer_id
  AND o.status IN ('aprovado','faturado','entregue') AND o.created_at<v_start);
 RETURN jsonb_build_object('meta',v_meta,'vendas_mes',v_vendas,'ticket_medio',CASE WHEN v_count>0 THEN round(v_vendas/v_count,2) ELSE 0 END,
 'pedidos_count',v_count,'daily',v_daily,'clientes_atendidos',v_atendidos,'clientes_positivados',v_customers,'clientes_ativados',v_ativados,
 'meta_clientes',v_customer_target,
 'clientes_a_atender',CASE WHEN v_customer_target IS NULL THEN NULL ELSE greatest(v_customer_target-v_customers,0) END,
 'visitas_realizadas',v_visits,'meta_visitas',v_visit_target,
 'visitas_a_realizar',CASE WHEN v_visit_target IS NULL THEN NULL ELSE greatest(v_visit_target-v_visits,0) END);
END; $function$;

CREATE OR REPLACE FUNCTION public.get_unserved_customers(p_seller_id uuid, p_period text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
DECLARE me record; v_start timestamptz; v_end timestamptz; v_sellers uuid[];
BEGIN
 SELECT * INTO me FROM public.current_profile();
 IF me.profile_id IS NULL OR me.role = 'cliente' THEN RAISE EXCEPTION 'Sem acesso aos indicadores'; END IF;
 IF p_period !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Período inválido'; END IF;
 v_start := (p_period || '-01')::date; v_end := v_start + interval '1 month';
 IF me.role = 'vendedor' THEN
  IF p_seller_id IS NOT NULL AND p_seller_id <> me.profile_id THEN RAISE EXCEPTION 'Vendedor só consulta a própria carteira'; END IF;
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
 RETURN coalesce((
  SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'cnpj_cpf', c.cnpj_cpf, 'phone', c.phone) ORDER BY c.name)
  FROM public.customers c
  WHERE c.organization_id = me.organization_id AND c.owner_id = ANY(v_sellers)
   AND NOT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.organization_id = me.organization_id AND o.customer_id = c.id
     AND o.status IN ('aprovado','faturado','entregue') AND o.created_at >= v_start AND o.created_at < v_end)
 ), '[]'::jsonb);
END; $function$;