-- Orçamentos: proposta montada no mesmo carrinho do pedido, com validade, que depois vira pedido.

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  seller_id uuid references public.profiles(id) on delete set null,
  status text not null default 'aberto' check (status in ('aberto','convertido','cancelado')),
  total_amount numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  valid_until date,
  notes text,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_quotes_organization_id on public.quotes(organization_id);
create index idx_quotes_customer_id on public.quotes(customer_id);
create index idx_quotes_seller_id on public.quotes(seller_id);
create index idx_quotes_status on public.quotes(status);
create index idx_quotes_org_created_at on public.quotes(organization_id, created_at);

create trigger trg_quotes_updated_at before update on public.quotes for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.quotes to authenticated;
grant all on public.quotes to service_role;

alter table public.quotes enable row level security;

create policy quotes_select on public.quotes for select to authenticated using (
  organization_id = (select organization_id from public.current_profile()) and (
    (select role from public.current_profile()) = 'administrador'
    or ((select role from public.current_profile()) = 'vendedor' and seller_id = auth.uid())
    or ((select role from public.current_profile()) = 'supervisor' and seller_id in (select id from public.profiles where supervisor_id = auth.uid()))));

create policy quotes_insert on public.quotes for insert to authenticated with check (
  organization_id = (select organization_id from public.current_profile()) and (
    ((select role from public.current_profile()) = 'vendedor' and seller_id = auth.uid())
    or (select role from public.current_profile()) = 'administrador'));

create policy quotes_update on public.quotes for update to authenticated using (
  organization_id = (select organization_id from public.current_profile()) and (
    (select role from public.current_profile()) = 'administrador'
    or ((select role from public.current_profile()) = 'vendedor' and seller_id = auth.uid() and status = 'aberto')))
  with check (organization_id = (select organization_id from public.current_profile()));

create policy quotes_delete on public.quotes for delete to authenticated using (
  organization_id = (select organization_id from public.current_profile()) and (
    (select role from public.current_profile()) = 'administrador'
    or ((select role from public.current_profile()) = 'vendedor' and seller_id = auth.uid() and status = 'aberto')));

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null default 1,
  unit_price numeric(14,2) not null,
  line_total numeric(14,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_quote_items_quote_id on public.quote_items(quote_id);
create index idx_quote_items_product_id on public.quote_items(product_id);

create trigger trg_quote_items_updated_at before update on public.quote_items for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.quote_items to authenticated;
grant all on public.quote_items to service_role;

alter table public.quote_items enable row level security;

create policy quote_items_select on public.quote_items for select to authenticated using (
  quote_id in (select id from public.quotes q where q.organization_id = (select organization_id from public.current_profile()) and (
    (select role from public.current_profile()) = 'administrador'
    or ((select role from public.current_profile()) = 'vendedor' and q.seller_id = auth.uid())
    or ((select role from public.current_profile()) = 'supervisor' and q.seller_id in (select id from public.profiles where supervisor_id = auth.uid())))));

create policy quote_items_insert on public.quote_items for insert to authenticated with check (
  quote_id in (select id from public.quotes q where q.organization_id = (select organization_id from public.current_profile()) and (
    (select role from public.current_profile()) = 'administrador'
    or ((select role from public.current_profile()) = 'vendedor' and q.seller_id = auth.uid()))));

create policy quote_items_update on public.quote_items for update to authenticated using (
  quote_id in (select id from public.quotes q where q.organization_id = (select organization_id from public.current_profile()) and (
    (select role from public.current_profile()) = 'administrador'
    or ((select role from public.current_profile()) = 'vendedor' and q.seller_id = auth.uid() and q.status = 'aberto'))))
  with check (quote_id in (select id from public.quotes q where q.organization_id = (select organization_id from public.current_profile())));

create policy quote_items_delete on public.quote_items for delete to authenticated using (
  quote_id in (select id from public.quotes q where q.organization_id = (select organization_id from public.current_profile()) and (
    (select role from public.current_profile()) = 'administrador'
    or ((select role from public.current_profile()) = 'vendedor' and q.seller_id = auth.uid()))));

-- Totais do orçamento: calculados pelo banco, o cliente nunca grava total/status.
create or replace function public.calc_quote_totals(p_quote_id uuid)
returns table(total_amount numeric, discount_amount numeric)
language plpgsql security definer set search_path = public as $$
declare v_quote public.quotes; v_me record; v_sub numeric; v_disc numeric;
begin
  select * into v_me from public.current_profile();
  select * into v_quote from public.quotes q where q.id = p_quote_id;
  if v_quote.id is null or v_quote.organization_id is distinct from v_me.organization_id then
    raise exception 'Orçamento não encontrado';
  end if;
  if not (v_me.role = 'administrador' or v_quote.seller_id = auth.uid()
          or (v_me.role = 'supervisor' and exists (select 1 from public.profiles p where p.id = v_quote.seller_id and p.supervisor_id = auth.uid()))) then
    raise exception 'Sem permissão para este orçamento';
  end if;
  if v_quote.status <> 'aberto' then
    return query select v_quote.total_amount, v_quote.discount_amount; return;
  end if;
  perform set_config('app.quote_internal', 'on', true);
  update public.quote_items i set unit_price = p.unit_price, line_total = round(i.quantity * p.unit_price, 2)
    from public.products p where p.id = i.product_id and i.quote_id = p_quote_id;
  select coalesce(sum(line_total), 0) into v_sub from public.quote_items where quote_id = p_quote_id;
  v_disc := least(greatest(v_quote.discount_amount, 0), v_sub);
  update public.quotes set total_amount = v_sub - v_disc, discount_amount = v_disc where id = p_quote_id;
  perform set_config('app.quote_internal', 'off', true);
  return query select v_sub - v_disc, v_disc;
end; $$;

-- Guarda o orçamento: status, totais e vínculo com o pedido só mudam por dentro.
create or replace function public.protect_quote_fields()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  if current_setting('app.quote_internal', true) = 'on' or auth.uid() is null then return new; end if;
  select role into v_role from public.current_profile();
  if tg_op = 'INSERT' then
    new.status := 'aberto'; new.total_amount := 0; new.order_id := null;
    return new;
  end if;
  if new.total_amount is distinct from old.total_amount
     or new.order_id is distinct from old.order_id
     or new.seller_id is distinct from old.seller_id
     or new.organization_id is distinct from old.organization_id then
    raise exception 'Alteração não permitida neste orçamento';
  end if;
  if new.status is distinct from old.status then
    if not (old.status = 'aberto' and new.status = 'cancelado'
            and (v_role = 'administrador' or old.seller_id = auth.uid())) then
      raise exception 'Use a conversão em pedido para mudar o status do orçamento';
    end if;
  end if;
  return new;
end; $$;

create trigger trg_quotes_protect_fields
  before insert or update on public.quotes
  for each row execute function public.protect_quote_fields();

-- Itens do orçamento: preço sempre vem do catálogo; só enquanto estiver aberto.
create or replace function public.protect_quote_items()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_status text; v_quote uuid;
begin
  if current_setting('app.quote_internal', true) = 'on' or auth.uid() is null then
    return coalesce(new, old);
  end if;
  v_quote := coalesce(new.quote_id, old.quote_id);
  select status into v_status from public.quotes where id = v_quote;
  if v_status is distinct from 'aberto' then
    raise exception 'Itens só podem ser alterados em orçamentos abertos';
  end if;
  if tg_op <> 'DELETE' then
    select unit_price into new.unit_price from public.products where id = new.product_id;
    new.line_total := round(new.quantity * new.unit_price, 2);
  end if;
  return coalesce(new, old);
end; $$;

create trigger trg_quote_items_protect
  before insert or update or delete on public.quote_items
  for each row execute function public.protect_quote_items();

-- Orçamento -> pedido: reaproveita o fluxo normal (estoque, totais, aprovação).
create or replace function public.convert_quote_to_order(p_quote_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_quote public.quotes; v_me record; v_tot record; v_order_id uuid; v_res jsonb;
begin
  select * into v_me from public.current_profile();
  select * into v_quote from public.quotes where id = p_quote_id;
  if v_quote.id is null or v_quote.organization_id is distinct from v_me.organization_id then
    raise exception 'Orçamento não encontrado';
  end if;
  if not (v_me.role = 'administrador' or v_quote.seller_id = auth.uid()) then
    raise exception 'Sem permissão para este orçamento';
  end if;
  if v_quote.status <> 'aberto' then raise exception 'Este orçamento já foi convertido ou cancelado'; end if;
  if v_quote.valid_until is not null and v_quote.valid_until < current_date then
    raise exception 'O orçamento está vencido';
  end if;
  if not exists (select 1 from public.quote_items where quote_id = p_quote_id) then
    raise exception 'O orçamento está sem itens';
  end if;
  select * into v_tot from public.calc_quote_totals(p_quote_id);
  if v_tot.total_amount is null or v_tot.total_amount <= 0 then raise exception 'O orçamento está sem itens'; end if;
  perform set_config('app.order_internal', 'on', true);
  insert into public.orders (organization_id, customer_id, seller_id, origin, status, total_amount, discount_amount, notes)
    values (v_quote.organization_id, v_quote.customer_id, v_quote.seller_id, 'vendedor', 'rascunho', v_tot.total_amount, v_tot.discount_amount, v_quote.notes)
    returning id into v_order_id;
  insert into public.order_items (order_id, product_id, quantity, unit_price, line_total, was_ai_suggested)
    select v_order_id, i.product_id, i.quantity, i.unit_price, i.line_total, false
      from public.quote_items i where i.quote_id = p_quote_id;
  perform set_config('app.order_internal', 'off', true);
  v_res := public.submit_order(v_order_id);
  perform set_config('app.quote_internal', 'on', true);
  update public.quotes set status = 'convertido', order_id = v_order_id where id = p_quote_id;
  perform set_config('app.quote_internal', 'off', true);
  return coalesce(v_res, '{}'::jsonb) || jsonb_build_object('quote_id', p_quote_id, 'order_id', v_order_id);
end; $$;

revoke execute on function public.calc_quote_totals(uuid) from public, anon;
revoke execute on function public.convert_quote_to_order(uuid) from public, anon;
grant execute on function public.calc_quote_totals(uuid) to authenticated;
grant execute on function public.convert_quote_to_order(uuid) to authenticated;