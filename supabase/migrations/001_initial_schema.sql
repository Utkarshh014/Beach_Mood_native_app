-- Beach Mood Phase 1 schema.
-- Requires a Supabase PostgreSQL project with PostGIS available.

create extension if not exists postgis;
create extension if not exists pgcrypto;

create type public.suitability_status as enum ('Safe', 'Caution', 'Hazard');
create type public.alert_severity as enum ('info', 'watch', 'warning', 'emergency');

create table public.beaches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  state text not null,
  district text,
  description text,
  location geography(Point, 4326) not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint beaches_name_nonempty check (length(trim(name)) > 0)
);

create index beaches_location_gist_idx
  on public.beaches using gist (location);

create index beaches_published_state_idx
  on public.beaches (is_published, state);

create table public.beach_conditions (
  id uuid primary key default gen_random_uuid(),
  beach_id uuid not null references public.beaches(id) on delete cascade,
  source text not null,
  source_record_id text,
  valid_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  wave_height_m numeric(6,2),
  wind_speed_ms numeric(6,2),
  peak_period_s numeric(6,2),
  current_speed_ms numeric(6,2),
  water_quality text,
  status public.suitability_status not null,
  risk_score integer not null default 0,
  reason_codes text[] not null default '{}',
  data_quality text not null default 'unknown',
  scoring_version text not null,
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint condition_wave_nonnegative
    check (wave_height_m is null or wave_height_m >= 0),
  constraint condition_wind_nonnegative
    check (wind_speed_ms is null or wind_speed_ms >= 0),
  constraint condition_period_nonnegative
    check (peak_period_s is null or peak_period_s >= 0),
  constraint condition_current_nonnegative
    check (current_speed_ms is null or current_speed_ms >= 0),
  constraint condition_quality
    check (data_quality in ('good', 'partial', 'stale', 'unknown'))
);

create index beach_conditions_latest_idx
  on public.beach_conditions (beach_id, valid_at desc, fetched_at desc);

create table public.ocean_alerts (
  id uuid primary key default gen_random_uuid(),
  beach_id uuid not null references public.beaches(id) on delete cascade,
  source text not null,
  source_alert_id text not null,
  alert_type text not null,
  severity public.alert_severity not null,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  is_active boolean not null default true,
  source_url text,
  fetched_at timestamptz not null default now(),
  raw_metadata jsonb not null default '{}'::jsonb,
  unique (source, source_alert_id, beach_id),
  constraint alert_valid_interval
    check (ends_at is null or ends_at > starts_at)
);

create index ocean_alerts_active_idx
  on public.ocean_alerts (beach_id, is_active, starts_at, ends_at);

create view public.beach_public_status
with (security_invoker = true) as
select
  b.id,
  b.name,
  b.slug,
  b.state,
  b.district,
  st_y(b.location::geometry) as latitude,
  st_x(b.location::geometry) as longitude,
  b.is_published,
  c.valid_at,
  c.fetched_at,
  c.wave_height_m,
  c.wind_speed_ms,
  c.peak_period_s,
  c.current_speed_ms,
  c.water_quality,
  c.status,
  c.risk_score,
  c.reason_codes,
  c.data_quality,
  c.scoring_version,
  coalesce(a.active_alerts, '[]'::jsonb) as active_alerts
from public.beaches b
left join lateral (
  select bc.*
  from public.beach_conditions bc
  where bc.beach_id = b.id
  order by bc.valid_at desc, bc.fetched_at desc
  limit 1
) c on true
left join lateral (
  select jsonb_agg(jsonb_build_object(
    'id', oa.id,
    'type', oa.alert_type,
    'severity', oa.severity,
    'title', oa.title,
    'description', oa.description,
    'starts_at', oa.starts_at,
    'ends_at', oa.ends_at,
    'source', oa.source,
    'source_url', oa.source_url
  )) as active_alerts
  from public.ocean_alerts oa
  where oa.beach_id = b.id
    and oa.is_active = true
    and oa.starts_at <= now()
    and (oa.ends_at is null or oa.ends_at > now())
) a on true
where b.is_published = true;

create or replace function public.get_nearby_beaches(
  lat double precision,
  lon double precision,
  radius_meters integer default 50000
)
returns table (
  id uuid,
  name text,
  slug text,
  state text,
  district text,
  latitude double precision,
  longitude double precision,
  distance_meters double precision,
  status public.suitability_status,
  valid_at timestamptz,
  fetched_at timestamptz,
  wave_height_m numeric,
  wind_speed_ms numeric,
  peak_period_s numeric,
  current_speed_ms numeric,
  water_quality text,
  risk_score integer,
  reason_codes text[],
  data_quality text,
  active_alerts jsonb
)
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  user_point geography(Point, 4326);
begin
  if lat is null
     or lon is null
     or lat < -90
     or lat > 90
     or lon < -180
     or lon > 180 then
    raise exception 'Invalid latitude or longitude' using errcode = '22023';
  end if;

  if radius_meters is null
     or radius_meters < 1
     or radius_meters > 200000 then
    raise exception 'radius_meters must be between 1 and 200000'
      using errcode = '22023';
  end if;

  user_point := st_setsrid(st_makepoint(lon, lat), 4326)::geography;

  return query
  select
    v.id,
    v.name,
    v.slug,
    v.state,
    v.district,
    v.latitude,
    v.longitude,
    st_distance(b.location, user_point) as distance_meters,
    v.status,
    v.valid_at,
    v.fetched_at,
    v.wave_height_m,
    v.wind_speed_ms,
    v.peak_period_s,
    v.current_speed_ms,
    v.water_quality,
    v.risk_score,
    v.reason_codes,
    v.data_quality,
    v.active_alerts
  from public.beaches b
  join public.beach_public_status v on v.id = b.id
  where b.is_published = true
    and st_dwithin(b.location, user_point, radius_meters)
  order by st_distance(b.location, user_point);
end;
$$;

alter table public.beaches enable row level security;
alter table public.beach_conditions enable row level security;
alter table public.ocean_alerts enable row level security;

create policy "public can read published beaches"
  on public.beaches
  for select
  to anon, authenticated
  using (is_published = true);

create policy "public can read conditions for published beaches"
  on public.beach_conditions
  for select
  to anon, authenticated
  using (exists (
    select 1
    from public.beaches b
    where b.id = beach_id
      and b.is_published = true
  ));

create policy "public can read alerts for published beaches"
  on public.ocean_alerts
  for select
  to anon, authenticated
  using (exists (
    select 1
    from public.beaches b
    where b.id = beach_id
      and b.is_published = true
  ));

grant select on public.beaches, public.beach_conditions, public.ocean_alerts
  to anon, authenticated;
grant select on public.beach_public_status to anon, authenticated;
grant execute on function public.get_nearby_beaches(
  double precision,
  double precision,
  integer
) to anon, authenticated;

revoke insert, update, delete
  on public.beaches, public.beach_conditions, public.ocean_alerts
  from anon, authenticated;
