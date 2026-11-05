alter table public.agenda_visits
  add constraint agenda_visits_checkin_requires_geo
  check (check_in_at is null or (check_in_lat is not null and check_in_lng is not null)) not valid;

comment on constraint agenda_visits_checkin_requires_geo on public.agenda_visits is 'Novos check-ins exigem latitude e longitude; registros antigos sem coordenadas são preservados (NOT VALID).';