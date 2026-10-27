CREATE OR REPLACE FUNCTION public.get_sales_flow(p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL)
RETURNS TABLE(status text, seller_id uuid, seller_name text, region text, orders_count bigint, total_amount numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
  SELECT o.status, o.seller_id, coalesce(p.full_name, 'E-commerce'),
         coalesce(nullif(upper(c.address->>'state'), ''), 'Sem região'),
         count(*), coalesce(sum(o.total_amount), 0)
  FROM public.orders o
  LEFT JOIN public.profiles p ON p.id = o.seller_id
  LEFT JOIN public.customers c ON c.id = o.customer_id
  WHERE (p_from IS NULL OR o.created_at >= p_from) AND (p_to IS NULL OR o.created_at < p_to)
  GROUP BY 1, 2, 3, 4
$$;
GRANT EXECUTE ON FUNCTION public.get_sales_flow(timestamptz, timestamptz) TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;