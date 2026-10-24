create or replace function public.calc_order_totals(p_order_id uuid)
returns table(total_amount numeric, discount_amount numeric)
language plpgsql security definer set search_path = public as $$
declare v_order public.orders; v_me record; v_sub numeric; v_disc numeric;
begin
  select * into v_me from public.current_profile();
  select * into v_order from public.orders o where o.id = p_order_id;
  if v_order.id is null or v_order.organization_id is distinct from v_me.organization_id then
    raise exception 'Pedido não encontrado';
  end if;
  if not (v_me.role = 'administrador' or v_order.seller_id = auth.uid()
          or exists (select 1 from public.customers c where c.id = v_order.customer_id and c.portal_user_id = auth.uid())) then
    raise exception 'Sem permissão para este pedido';
  end if;
  if v_order.status <> 'rascunho' then
    return query select v_order.total_amount, v_order.discount_amount; return;
  end if;
  perform set_config('app.order_internal', 'on', true);
  update public.order_items i set unit_price = p.unit_price, line_total = round(i.quantity * p.unit_price, 2)
    from public.products p where p.id = i.product_id and i.order_id = p_order_id;
  select coalesce(sum(line_total), 0) into v_sub from public.order_items where order_id = p_order_id;
  v_disc := least(greatest(v_order.discount_amount, 0), v_sub);
  update public.orders set total_amount = v_sub - v_disc, discount_amount = v_disc where id = p_order_id;
  perform set_config('app.order_internal', 'off', true);
  return query select v_sub - v_disc, v_disc;
end; $$;

create or replace function public.submit_order(p_order_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_order public.orders; v_tot record; v_sub numeric; v_pct numeric; v_credit text; v_needs boolean; v_status text; v_org_settings jsonb;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then raise exception 'Pedido não encontrado'; end if;
  if v_order.status <> 'rascunho' then raise exception 'Apenas pedidos em rascunho podem ser confirmados'; end if;
  select * into v_tot from public.calc_order_totals(p_order_id);
  if not exists (select 1 from public.order_items where order_id = p_order_id) then
    raise exception 'Adicione ao menos um produto';
  end if;
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
  update public.orders set status = v_status, needs_approval = v_needs,
    approved_at = case when v_needs then null else now() end
    where id = p_order_id;
  perform set_config('app.order_internal', 'off', true);
  return jsonb_build_object('order_id', p_order_id, 'status', v_status, 'needs_approval', v_needs, 'total_amount', v_tot.total_amount);
end; $$;

create or replace function public.set_order_erp_result(p_order_id uuid, p_status text, p_erp_order_id text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_me record;
begin
  select * into v_me from public.current_profile();
  if v_me.role not in ('supervisor','administrador') then raise exception 'Sem permissão'; end if;
  if p_status not in ('pendente','sincronizado','erro') then raise exception 'Status inválido'; end if;
  if not exists (select 1 from public.orders o where o.id = p_order_id and o.organization_id = v_me.organization_id
     and (v_me.role = 'administrador' or o.seller_id in (select id from public.profiles where supervisor_id = auth.uid()))) then
    raise exception 'Pedido não encontrado';
  end if;
  perform set_config('app.order_internal', 'on', true);
  update public.orders set erp_sync_status = p_status, erp_order_id = coalesce(p_erp_order_id, erp_order_id) where id = p_order_id;
  perform set_config('app.order_internal', 'off', true);
end; $$;

create or replace function public.protect_order_fields()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  if current_setting('app.order_internal', true) = 'on' or auth.uid() is null then return new; end if;
  select role into v_role from public.current_profile();
  if tg_op = 'INSERT' then
    new.status := 'rascunho'; new.needs_approval := false; new.approved_by := null; new.approved_at := null;
    new.erp_sync_status := 'pendente'; new.erp_order_id := null; new.total_amount := 0;
    return new;
  end if;
  if v_role = 'administrador' then return new; end if;
  if new.erp_sync_status is distinct from old.erp_sync_status or new.erp_order_id is distinct from old.erp_order_id
     or new.total_amount is distinct from old.total_amount or new.needs_approval is distinct from old.needs_approval
     or new.seller_id is distinct from old.seller_id or new.organization_id is distinct from old.organization_id then
    raise exception 'Alteração não permitida neste pedido';
  end if;
  if v_role = 'supervisor' then
    if new.status is distinct from old.status then
      if not (old.status = 'aguardando_aprovacao' and new.status in ('aprovado','recusado')) then
        raise exception 'O supervisor só pode aprovar ou recusar pedidos aguardando aprovação';
      end if;
      new.approved_by := auth.uid(); new.approved_at := now();
    elsif new.approved_by is distinct from old.approved_by or new.approved_at is distinct from old.approved_at then
      raise exception 'Alteração não permitida neste pedido';
    end if;
    return new;
  end if;
  if new.status is distinct from old.status or new.approved_by is distinct from old.approved_by
     or new.approved_at is distinct from old.approved_at then
    raise exception 'Use a confirmação do pedido para mudar o status';
  end if;
  return new;
end; $$;

create trigger trg_orders_protect_fields
  before insert or update on public.orders
  for each row execute function public.protect_order_fields();

create or replace function public.protect_order_items()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_status text; v_order uuid;
begin
  if current_setting('app.order_internal', true) = 'on' or auth.uid() is null then
    return coalesce(new, old);
  end if;
  v_order := coalesce(new.order_id, old.order_id);
  select status into v_status from public.orders where id = v_order;
  if v_status is distinct from 'rascunho' then
    raise exception 'Itens só podem ser alterados em pedidos em rascunho';
  end if;
  if tg_op <> 'DELETE' then
    select unit_price into new.unit_price from public.products where id = new.product_id;
    new.line_total := round(new.quantity * new.unit_price, 2);
  end if;
  return coalesce(new, old);
end; $$;

create trigger trg_order_items_protect
  before insert or update or delete on public.order_items
  for each row execute function public.protect_order_items();

revoke execute on function public.calc_order_totals(uuid) from public, anon;
revoke execute on function public.submit_order(uuid) from public, anon;
revoke execute on function public.set_order_erp_result(uuid, text, text) from public, anon;
grant execute on function public.calc_order_totals(uuid) to authenticated;
grant execute on function public.submit_order(uuid) to authenticated;
grant execute on function public.set_order_erp_result(uuid, text, text) to authenticated;