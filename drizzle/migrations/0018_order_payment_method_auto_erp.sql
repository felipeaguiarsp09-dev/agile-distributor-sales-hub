ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('dinheiro','cartao_credito','cartao_debito','boleto','cheque','deposito','bonificacao','multiplas'));

CREATE OR REPLACE FUNCTION public.set_order_erp_result(p_order_id uuid, p_status text, p_erp_order_id text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_me record;
begin
  select * into v_me from public.current_profile();
  if v_me.role not in ('vendedor','supervisor','administrador') then raise exception 'Sem permissão'; end if;
  if p_status not in ('pendente','sincronizado','erro') then raise exception 'Status inválido'; end if;
  if not exists (select 1 from public.orders o where o.id = p_order_id and o.organization_id = v_me.organization_id
     and (v_me.role = 'administrador'
          or (v_me.role = 'supervisor' and o.seller_id in (select id from public.profiles where supervisor_id = auth.uid()))
          or (v_me.role = 'vendedor' and o.seller_id = auth.uid()))) then
    raise exception 'Pedido não encontrado';
  end if;
  perform set_config('app.order_internal', 'on', true);
  update public.orders set erp_sync_status = p_status, erp_order_id = coalesce(p_erp_order_id, erp_order_id) where id = p_order_id;
  perform set_config('app.order_internal', 'off', true);
end; $function$;