CREATE OR REPLACE FUNCTION public.get_stock_sync_status()
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT max(ic.last_sync_at) FROM public.integration_configs ic
  JOIN public.profiles p ON p.organization_id = ic.organization_id
  WHERE p.id = auth.uid() AND ic.integration_type IN ('estoque','erp') AND ic.is_active
$$;
REVOKE ALL ON FUNCTION public.get_stock_sync_status() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_stock_sync_status() TO authenticated;