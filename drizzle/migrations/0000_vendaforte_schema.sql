create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end; $$;

create table public.organizations (id uuid primary key default gen_random_uuid(), name text not null, cnpj text, settings jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  full_name text not null,
  role text not null default 'vendedor' check (role in ('vendedor','supervisor','administrador','cliente')),
  supervisor_id uuid references public.profiles(id) on delete set null,
  phone text, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index idx_profiles_organization_id on public.profiles(organization_id);
create index idx_profiles_role on public.profiles(role);
create index idx_profiles_supervisor_id on public.profiles(supervisor_id);

create or replace function public.current_profile()
returns table (profile_id uuid, organization_id uuid, role text, supervisor_id uuid)
language sql stable security definer set search_path = public
as $$ select p.id, p.organization_id, p.role, p.supervisor_id from public.profiles p where p.id = auth.uid(); $$;
grant execute on function public.current_profile() to authenticated;

create trigger trg_organizations_updated_at before update on public.organizations for each row execute function public.set_updated_at();
grant select, insert, update, delete on public.organizations to authenticated;
grant all on public.organizations to service_role;
alter table public.organizations enable row level security;
create policy organizations_select on public.organizations for select to authenticated using (id = (select organization_id from public.current_profile()));
create policy organizations_insert on public.organizations for insert to authenticated with check (false);
create policy organizations_update on public.organizations for update to authenticated using (id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador') with check (id = (select organization_id from public.current_profile()));
create policy organizations_delete on public.organizations for delete to authenticated using (false);

create trigger trg_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador')
  or ((select role from public.current_profile()) = 'supervisor' and supervisor_id = auth.uid()));
create policy profiles_insert on public.profiles for insert to authenticated with check (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador');
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador'))
  with check (id = auth.uid() or (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador'));
create policy profiles_delete on public.profiles for delete to authenticated using (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador');

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  external_id text, name text not null, cnpj_cpf text, email text, phone text,
  address jsonb not null default '{}',
  credit_limit numeric(14,2) not null default 0,
  credit_status text not null default 'ok' check (credit_status in ('ok','restrito','bloqueado')),
  portal_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index idx_customers_organization_id on public.customers(organization_id);
create index idx_customers_owner_id on public.customers(owner_id);
create index idx_customers_external_id on public.customers(external_id);
create index idx_customers_credit_status on public.customers(credit_status);
create index idx_customers_portal_user_id on public.customers(portal_user_id);
create trigger trg_customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
grant select, insert, update, delete on public.customers to authenticated;
grant all on public.customers to service_role;
alter table public.customers enable row level security;
create policy customers_select on public.customers for select to authenticated using (
  organization_id = (select organization_id from public.current_profile()) and (
    (select role from public.current_profile()) = 'administrador'
    or ((select role from public.current_profile()) = 'vendedor' and owner_id = auth.uid())
    or ((select role from public.current_profile()) = 'supervisor' and owner_id in (select id from public.profiles where supervisor_id = auth.uid()))
    or ((select role from public.current_profile()) = 'cliente' and portal_user_id = auth.uid())));
create policy customers_insert on public.customers for insert to authenticated with check (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador');
create policy customers_update on public.customers for update to authenticated using (
  organization_id = (select organization_id from public.current_profile()) and (
    (select role from public.current_profile()) = 'administrador'
    or ((select role from public.current_profile()) = 'vendedor' and owner_id = auth.uid())))
  with check (organization_id = (select organization_id from public.current_profile()));
create policy customers_delete on public.customers for delete to authenticated using (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  external_id text, sku text not null, name text not null, description text, category text,
  unit_price numeric(14,2) not null default 0, stock_quantity integer not null default 0,
  is_ecommerce_visible boolean not null default false, image_url text, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index idx_products_organization_id on public.products(organization_id);
create index idx_products_category on public.products(category);
create index idx_products_sku on public.products(sku);
create index idx_products_external_id on public.products(external_id);
create index idx_products_is_ecommerce_visible on public.products(is_ecommerce_visible);
create trigger trg_products_updated_at before update on public.products for each row execute function public.set_updated_at();
grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy products_select on public.products for select to authenticated using (
  organization_id = (select organization_id from public.current_profile()) and (
    (select role from public.current_profile()) in ('vendedor','supervisor','administrador')
    or ((select role from public.current_profile()) = 'cliente' and is_ecommerce_visible = true)));
create policy products_insert on public.products for insert to authenticated with check (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador');
create policy products_update on public.products for update to authenticated using (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador') with check (organization_id = (select organization_id from public.current_profile()));
create policy products_delete on public.products for delete to authenticated using (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  seller_id uuid references public.profiles(id) on delete set null,
  origin text not null default 'vendedor' check (origin in ('vendedor','ecommerce')),
  status text not null default 'rascunho' check (status in ('rascunho','aguardando_aprovacao','aprovado','recusado','faturado','cancelado')),
  total_amount numeric(14,2) not null default 0, discount_amount numeric(14,2) not null default 0,
  needs_approval boolean not null default false,
  approved_by uuid references public.profiles(id) on delete set null, approved_at timestamptz,
  erp_sync_status text not null default 'pendente' check (erp_sync_status in ('pendente','sincronizado','erro')),
  erp_order_id text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index idx_orders_organization_id on public.orders(organization_id);
create index idx_orders_customer_id on public.orders(customer_id);
create index idx_orders_seller_id on public.orders(seller_id);
create index idx_orders_status on public.orders(status);
create index idx_orders_origin on public.orders(origin);
create index idx_orders_approved_by on public.orders(approved_by);
create index idx_orders_org_created_at on public.orders(organization_id, created_at);
create trigger trg_update_order_updated_at before update on public.orders for each row execute function public.set_updated_at();
grant select, insert, update, delete on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy orders_select on public.orders for select to authenticated using (
  organization_id = (select organization_id from public.current_profile()) and (
    (select role from public.current_profile()) = 'administrador'
    or ((select role from public.current_profile()) = 'vendedor' and seller_id = auth.uid())
    or ((select role from public.current_profile()) = 'supervisor' and seller_id in (select id from public.profiles where supervisor_id = auth.uid()))
    or ((select role from public.current_profile()) = 'cliente' and customer_id in (select id from public.customers where portal_user_id = auth.uid()))));
create policy orders_insert on public.orders for insert to authenticated with check (
  organization_id = (select organization_id from public.current_profile()) and (
    ((select role from public.current_profile()) = 'vendedor' and seller_id = auth.uid())
    or ((select role from public.current_profile()) = 'cliente' and customer_id in (select id from public.customers where portal_user_id = auth.uid()))
    or (select role from public.current_profile()) = 'administrador'));
create policy orders_update on public.orders for update to authenticated using (
  organization_id = (select organization_id from public.current_profile()) and (
    (select role from public.current_profile()) = 'administrador'
    or ((select role from public.current_profile()) = 'vendedor' and seller_id = auth.uid() and status = 'rascunho')
    or ((select role from public.current_profile()) = 'supervisor' and seller_id in (select id from public.profiles where supervisor_id = auth.uid()))))
  with check (organization_id = (select organization_id from public.current_profile()));
create policy orders_delete on public.orders for delete to authenticated using (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador');

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null default 1, unit_price numeric(14,2) not null, line_total numeric(14,2) not null,
  was_ai_suggested boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index idx_order_items_order_id on public.order_items(order_id);
create index idx_order_items_product_id on public.order_items(product_id);
create trigger trg_order_items_updated_at before update on public.order_items for each row execute function public.set_updated_at();
grant select, insert, update, delete on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy order_items_select on public.order_items for select to authenticated using (
  order_id in (select id from public.orders o where o.organization_id = (select organization_id from public.current_profile()) and (
    (select role from public.current_profile()) = 'administrador'
    or ((select role from public.current_profile()) = 'vendedor' and o.seller_id = auth.uid())
    or ((select role from public.current_profile()) = 'supervisor' and o.seller_id in (select id from public.profiles where supervisor_id = auth.uid()))
    or ((select role from public.current_profile()) = 'cliente' and o.customer_id in (select id from public.customers where portal_user_id = auth.uid())))));
create policy order_items_insert on public.order_items for insert to authenticated with check (
  order_id in (select id from public.orders o where o.organization_id = (select organization_id from public.current_profile()) and (
    (select role from public.current_profile()) = 'administrador'
    or ((select role from public.current_profile()) = 'vendedor' and o.seller_id = auth.uid())
    or ((select role from public.current_profile()) = 'cliente' and o.customer_id in (select id from public.customers where portal_user_id = auth.uid())))));
create policy order_items_update on public.order_items for update to authenticated using (
  order_id in (select id from public.orders o where o.organization_id = (select organization_id from public.current_profile()) and (
    (select role from public.current_profile()) = 'administrador'
    or ((select role from public.current_profile()) = 'vendedor' and o.seller_id = auth.uid() and o.status = 'rascunho'))))
  with check (order_id in (select id from public.orders o where o.organization_id = (select organization_id from public.current_profile())));
create policy order_items_delete on public.order_items for delete to authenticated using (
  order_id in (select id from public.orders o where o.organization_id = (select organization_id from public.current_profile()) and (
    (select role from public.current_profile()) = 'administrador'
    or ((select role from public.current_profile()) = 'vendedor' and o.seller_id = auth.uid() and o.status = 'rascunho'))));

create table public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  order_id uuid references public.orders(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  suggested_product_id uuid not null references public.products(id) on delete cascade,
  reason text, score numeric(5,4), was_accepted boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index idx_ai_suggestions_order_id on public.ai_suggestions(order_id);
create index idx_ai_suggestions_customer_id on public.ai_suggestions(customer_id);
create index idx_ai_suggestions_organization_id on public.ai_suggestions(organization_id);
create trigger trg_ai_suggestions_updated_at before update on public.ai_suggestions for each row execute function public.set_updated_at();
grant select, insert, update, delete on public.ai_suggestions to authenticated;
grant all on public.ai_suggestions to service_role;
alter table public.ai_suggestions enable row level security;
create policy ai_suggestions_select on public.ai_suggestions for select to authenticated using (
  organization_id = (select organization_id from public.current_profile()) and (
    (select role from public.current_profile()) in ('supervisor','administrador')
    or ((select role from public.current_profile()) = 'vendedor' and customer_id in (select id from public.customers where owner_id = auth.uid()))));
create policy ai_suggestions_insert on public.ai_suggestions for insert to authenticated with check (false);
create policy ai_suggestions_update on public.ai_suggestions for update to authenticated using (
  organization_id = (select organization_id from public.current_profile())
  and ((select role from public.current_profile()) = 'vendedor' and customer_id in (select id from public.customers where owner_id = auth.uid())))
  with check (organization_id = (select organization_id from public.current_profile()));
create policy ai_suggestions_delete on public.ai_suggestions for delete to authenticated using (false);

create table public.demand_forecasts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete cascade,
  period_start date not null, period_end date not null,
  forecast_quantity numeric(14,2) not null, confidence numeric(5,4), rationale text,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index idx_demand_forecasts_organization_id on public.demand_forecasts(organization_id);
create index idx_demand_forecasts_product_id on public.demand_forecasts(product_id);
create index idx_demand_forecasts_product_period on public.demand_forecasts(product_id, period_start);
create trigger trg_demand_forecasts_updated_at before update on public.demand_forecasts for each row execute function public.set_updated_at();
grant select, insert, update, delete on public.demand_forecasts to authenticated;
grant all on public.demand_forecasts to service_role;
alter table public.demand_forecasts enable row level security;
create policy demand_forecasts_select on public.demand_forecasts for select to authenticated using (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) in ('supervisor','administrador'));
create policy demand_forecasts_insert on public.demand_forecasts for insert to authenticated with check (false);
create policy demand_forecasts_update on public.demand_forecasts for update to authenticated using (false) with check (false);
create policy demand_forecasts_delete on public.demand_forecasts for delete to authenticated using (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador');

create table public.indicator_insights (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  scope text not null check (scope in ('vendedor','equipe','global')),
  scope_ref_id uuid, period text not null, insight_text text not null,
  metrics_snapshot jsonb not null default '{}', generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index idx_indicator_insights_organization_id on public.indicator_insights(organization_id);
create index idx_indicator_insights_scope_ref_period on public.indicator_insights(scope, scope_ref_id, period);
create trigger trg_indicator_insights_updated_at before update on public.indicator_insights for each row execute function public.set_updated_at();
grant select, insert, update, delete on public.indicator_insights to authenticated;
grant all on public.indicator_insights to service_role;
alter table public.indicator_insights enable row level security;
create policy indicator_insights_select on public.indicator_insights for select to authenticated using (
  organization_id = (select organization_id from public.current_profile()) and (
    (select role from public.current_profile()) in ('supervisor','administrador')
    or ((select role from public.current_profile()) = 'vendedor' and scope = 'vendedor' and scope_ref_id = auth.uid())));
create policy indicator_insights_insert on public.indicator_insights for insert to authenticated with check (false);
create policy indicator_insights_update on public.indicator_insights for update to authenticated using (false) with check (false);
create policy indicator_insights_delete on public.indicator_insights for delete to authenticated using (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador');

create table public.sales_targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  period text not null, target_amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index idx_sales_targets_organization_id on public.sales_targets(organization_id);
create index idx_sales_targets_seller_id on public.sales_targets(seller_id);
create index idx_sales_targets_seller_period on public.sales_targets(seller_id, period);
create trigger trg_sales_targets_updated_at before update on public.sales_targets for each row execute function public.set_updated_at();
grant select, insert, update, delete on public.sales_targets to authenticated;
grant all on public.sales_targets to service_role;
alter table public.sales_targets enable row level security;
create policy sales_targets_select on public.sales_targets for select to authenticated using (
  organization_id = (select organization_id from public.current_profile()) and (
    (select role from public.current_profile()) in ('supervisor','administrador')
    or ((select role from public.current_profile()) = 'vendedor' and seller_id = auth.uid())));
create policy sales_targets_insert on public.sales_targets for insert to authenticated with check (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) in ('supervisor','administrador'));
create policy sales_targets_update on public.sales_targets for update to authenticated using (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) in ('supervisor','administrador')) with check (organization_id = (select organization_id from public.current_profile()));
create policy sales_targets_delete on public.sales_targets for delete to authenticated using (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) in ('supervisor','administrador'));

create table public.agenda_visits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'planejada' check (status in ('planejada','realizada','cancelada')),
  check_in_at timestamptz, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index idx_agenda_visits_organization_id on public.agenda_visits(organization_id);
create index idx_agenda_visits_seller_id on public.agenda_visits(seller_id);
create index idx_agenda_visits_customer_id on public.agenda_visits(customer_id);
create index idx_agenda_visits_seller_scheduled on public.agenda_visits(seller_id, scheduled_at);
create trigger trg_agenda_visits_updated_at before update on public.agenda_visits for each row execute function public.set_updated_at();
grant select, insert, update, delete on public.agenda_visits to authenticated;
grant all on public.agenda_visits to service_role;
alter table public.agenda_visits enable row level security;
create policy agenda_visits_select on public.agenda_visits for select to authenticated using (
  organization_id = (select organization_id from public.current_profile()) and (
    (select role from public.current_profile()) = 'administrador' or seller_id = auth.uid()
    or ((select role from public.current_profile()) = 'supervisor' and seller_id in (select id from public.profiles where supervisor_id = auth.uid()))));
create policy agenda_visits_insert on public.agenda_visits for insert to authenticated with check (organization_id = (select organization_id from public.current_profile()) and (seller_id = auth.uid() or (select role from public.current_profile()) = 'administrador'));
create policy agenda_visits_update on public.agenda_visits for update to authenticated using (organization_id = (select organization_id from public.current_profile()) and (seller_id = auth.uid() or (select role from public.current_profile()) = 'administrador')) with check (organization_id = (select organization_id from public.current_profile()));
create policy agenda_visits_delete on public.agenda_visits for delete to authenticated using (organization_id = (select organization_id from public.current_profile()) and (seller_id = auth.uid() or (select role from public.current_profile()) = 'administrador'));

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  gateway text not null, gateway_payment_id text, amount numeric(14,2) not null,
  status text not null default 'pendente' check (status in ('pendente','pago','falhou','estornado')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index idx_payments_order_id on public.payments(order_id);
create index idx_payments_gateway_payment_id on public.payments(gateway_payment_id);
create index idx_payments_organization_id on public.payments(organization_id);
create trigger trg_payments_updated_at before update on public.payments for each row execute function public.set_updated_at();
grant select, insert, update, delete on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy payments_select on public.payments for select to authenticated using (
  organization_id = (select organization_id from public.current_profile()) and (
    (select role from public.current_profile()) in ('supervisor','administrador')
    or ((select role from public.current_profile()) = 'cliente' and order_id in (select o.id from public.orders o join public.customers c on c.id = o.customer_id where c.portal_user_id = auth.uid()))));
create policy payments_insert on public.payments for insert to authenticated with check (false);
create policy payments_update on public.payments for update to authenticated using (false) with check (false);
create policy payments_delete on public.payments for delete to authenticated using (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador');

create table public.integration_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  integration_type text not null check (integration_type in ('erp','estoque','financeiro','pagamento')),
  provider text, credentials jsonb not null default '{}', is_active boolean not null default true, last_sync_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index idx_integration_configs_org_type on public.integration_configs(organization_id, integration_type);
create trigger trg_integration_configs_updated_at before update on public.integration_configs for each row execute function public.set_updated_at();
grant select, insert, update, delete on public.integration_configs to authenticated;
grant all on public.integration_configs to service_role;
alter table public.integration_configs enable row level security;
create policy integration_configs_select on public.integration_configs for select to authenticated using (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador');
create policy integration_configs_insert on public.integration_configs for insert to authenticated with check (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador');
create policy integration_configs_update on public.integration_configs for update to authenticated using (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador') with check (organization_id = (select organization_id from public.current_profile()));
create policy integration_configs_delete on public.integration_configs for delete to authenticated using (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador');

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  entity_type text not null check (entity_type in ('customers','products','orders')),
  file_url text,
  status text not null default 'pendente' check (status in ('pendente','processando','concluido','erro')),
  rows_total integer not null default 0, rows_imported integer not null default 0,
  error_log jsonb not null default '[]',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index idx_import_jobs_organization_id on public.import_jobs(organization_id);
create index idx_import_jobs_status on public.import_jobs(status);
create index idx_import_jobs_created_by on public.import_jobs(created_by);
create trigger trg_import_jobs_updated_at before update on public.import_jobs for each row execute function public.set_updated_at();
grant select, insert, update, delete on public.import_jobs to authenticated;
grant all on public.import_jobs to service_role;
alter table public.import_jobs enable row level security;
create policy import_jobs_select on public.import_jobs for select to authenticated using (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador');
create policy import_jobs_insert on public.import_jobs for insert to authenticated with check (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador');
create policy import_jobs_update on public.import_jobs for update to authenticated using (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador') with check (organization_id = (select organization_id from public.current_profile()));
create policy import_jobs_delete on public.import_jobs for delete to authenticated using (organization_id = (select organization_id from public.current_profile()) and (select role from public.current_profile()) = 'administrador');

-- Bootstrap
insert into public.organizations (name) values ('Distribuidora VendaForte');

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_role text;
begin
  select id into v_org from public.organizations order by created_at limit 1;
  if exists (select 1 from public.profiles) then v_role := 'vendedor'; else v_role := 'administrador'; end if;
  insert into public.profiles (id, organization_id, full_name, role)
  values (new.id, v_org, coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)), v_role);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.protect_profile_fields() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if (select role from public.current_profile()) = 'administrador' then return new; end if;
  if new.role is distinct from old.role or new.organization_id is distinct from old.organization_id
     or new.supervisor_id is distinct from old.supervisor_id or new.is_active is distinct from old.is_active then
    raise exception 'Somente o administrador pode alterar papel, organização, supervisor ou status';
  end if;
  return new;
end; $$;
create trigger trg_profiles_protect_fields before update on public.profiles for each row execute function public.protect_profile_fields();