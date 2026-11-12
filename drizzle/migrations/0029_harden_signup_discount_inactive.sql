CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_org uuid;
begin
  select id into v_org from public.organizations order by created_at limit 1;
  insert into public.profiles (id, organization_id, full_name, role)
  values (new.id, v_org, coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)), 'vendedor');
  return new;
end; $function$;

CREATE OR REPLACE FUNCTION public.current_profile()
 RETURNS TABLE(profile_id uuid, organization_id uuid, role text, supervisor_id uuid)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ select p.id, p.organization_id, p.role, p.supervisor_id from public.profiles p where p.id = auth.uid() and p.is_active; $function$;

CREATE OR REPLACE FUNCTION public.protect_order_fields()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_role text;
begin
  if current_setting('app.order_internal', true) = 'on' or auth.uid() is null then return new; end if;
  select role into v_role from public.current_profile();
  if tg_op = 'INSERT' then
    new.status := 'rascunho'; new.needs_approval := false; new.approved_by := null; new.approved_at := null;
    new.erp_sync_status := 'pendente'; new.erp_order_id := null; new.total_amount := 0;
    if v_role is distinct from 'administrador' and v_role is distinct from 'supervisor' and v_role is distinct from 'vendedor' then
      new.discount_amount := 0;
    end if;
    return new;
  end if;
  if v_role = 'administrador' then return new; end if;
  if v_role is distinct from 'supervisor' and v_role is distinct from 'vendedor'
     and new.discount_amount is distinct from old.discount_amount then
    raise exception 'Alteração não permitida neste pedido';
  end if;
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
end; $function$;