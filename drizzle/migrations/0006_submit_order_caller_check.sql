CREATE OR REPLACE FUNCTION public.submit_order(p_order_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_order public.orders; v_me record; v_tot record; v_sub numeric; v_pct numeric; v_credit text; v_needs boolean; v_status text; v_org_settings jsonb;
begin
  select * into v_me from public.current_profile();
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null or v_me.profile_id is null or v_order.organization_id is distinct from v_me.organization_id then raise exception 'Pedido não encontrado'; end if;
  if not ((v_me.role = 'administrador') or (v_me.role = 'vendedor' and v_order.seller_id = auth.uid())
          or (v_me.role = 'cliente' and v_order.origin = 'ecommerce' and exists (select 1 from public.customers c where c.id = v_order.customer_id and c.portal_user_id = auth.uid()))) then
    raise exception 'Sem permissão para este pedido';
  end if;
  if v_order.status <> 'rascunho' then raise exception 'Apenas pedidos em rascunho podem ser confirmados'; end if;
  select * into v_tot from public.calc_order_totals(p_order_id);
  if not exists (select 1 from public.order_items where order_id = p_order_id) then raise exception 'Adicione ao menos um produto'; end if;
  if exists (select 1 from public.order_items i join public.products p on p.id = i.product_id
             where i.order_id = p_order_id and (i.quantity > p.stock_quantity or not p.is_active)) then
    raise exception 'Estoque insuficiente para um ou mais itens';
  end if;
  select settings into v_org_settings from public.organizations where id = v_order.organization_id;
  v_pct := coalesce((v_org_settings->>'max_discount_percent')::numeric, 0);
  v_sub := v_tot.total_amount + v_tot.discount_amount;
  select credit_status into v_credit from public.customers where id = v_order.customer_id;
  v_needs := v_tot.discount_amount > round(v_sub * v_pct / 100, 2) or v_credit in ('restrito','bloqueado');
  v_status := case when v_needs then 'aguardando_aprovacao' else 'aprovado' end;
  perform set_config('app.order_internal', 'on', true);
  update public.orders set status = v_status, needs_approval = v_needs, approved_at = case when v_needs then null else now() end where id = p_order_id;
  perform set_config('app.order_internal', 'off', true);
  return jsonb_build_object('order_id', p_order_id, 'status', v_status, 'needs_approval', v_needs, 'total_amount', v_tot.total_amount);
end; $function$;