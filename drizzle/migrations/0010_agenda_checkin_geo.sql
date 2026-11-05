alter table public.agenda_visits
  add column if not exists check_in_lat double precision,
  add column if not exists check_in_lng double precision,
  add column if not exists check_in_accuracy_m double precision;