CREATE POLICY "Admin envia arquivos de importação" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'imports' AND EXISTS (SELECT 1 FROM public.current_profile() p WHERE p.role = 'administrador' AND (storage.foldername(name))[1] = p.organization_id::text));
CREATE POLICY "Admin lê arquivos de importação" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'imports' AND EXISTS (SELECT 1 FROM public.current_profile() p WHERE p.role = 'administrador' AND (storage.foldername(name))[1] = p.organization_id::text));

CREATE OR REPLACE FUNCTION public.get_seller_indicators(p_seller_id uuid, p_period text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
DECLARE me record; v_start timestamptz; v_end timestamptz; v_sellers uuid[]; v_meta numeric; v_vendas numeric; v_count int; v_daily jsonb;
BEGIN
  SELECT * INTO me FROM public.current_profile();
  IF me.profile_id IS NULL OR me.role = 'cliente' THEN RAISE EXCEPTION 'Sem acesso aos indicadores'; END IF;
  IF p_period !~ '^\d{4}-\d{2}$' THEN RAISE EXCEPTION 'Período inválido'; END IF;
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
  SELECT coalesce(sum(target_amount), 0) INTO v_meta FROM public.sales_targets
    WHERE organization_id = me.organization_id AND period = p_period AND seller_id = ANY(v_sellers);
  SELECT coalesce(sum(total_amount), 0), count(*) INTO v_vendas, v_count FROM public.orders
    WHERE organization_id = me.organization_id AND status IN ('aprovado','faturado') AND created_at >= v_start AND created_at < v_end
      AND (seller_id = ANY(v_sellers) OR (p_seller_id IS NULL AND me.role = 'administrador'));
  SELECT coalesce(jsonb_agg(jsonb_build_object('day', d, 'total', t) ORDER BY d), '[]') INTO v_daily FROM (
    SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS d, sum(total_amount) AS t FROM public.orders
    WHERE organization_id = me.organization_id AND status IN ('aprovado','faturado') AND created_at >= v_start AND created_at < v_end
      AND (seller_id = ANY(v_sellers) OR (p_seller_id IS NULL AND me.role = 'administrador'))
    GROUP BY 1) x;
  RETURN jsonb_build_object('meta', v_meta, 'vendas_mes', v_vendas,
    'ticket_medio', CASE WHEN v_count > 0 THEN round(v_vendas / v_count, 2) ELSE 0 END, 'pedidos_count', v_count, 'daily', v_daily);
END; $function$;