-- Beach Mood Phase 1 baseline catalogue.
--
-- Coordinates and ocean values are illustrative baseline records for initial
-- phone testing. They are not authoritative observations or safety advice.

insert into public.beaches (
  name,
  slug,
  state,
  district,
  description,
  location,
  is_published
)
values
  (
    'Marina Beach',
    'marina-beach',
    'Tamil Nadu',
    'Chennai',
    'Urban beach along the Bay of Bengal.',
    st_setsrid(st_makepoint(80.2837, 13.0500), 4326)::geography,
    true
  ),
  (
    'Calangute Beach',
    'calangute-beach',
    'Goa',
    'North Goa',
    'Popular North Goa beach on the Arabian Sea.',
    st_setsrid(st_makepoint(73.7553, 15.5440), 4326)::geography,
    true
  ),
  (
    'Kovalam Beach',
    'kovalam-beach',
    'Kerala',
    'Thiruvananthapuram',
    'Coastal beach destination south of Thiruvananthapuram.',
    st_setsrid(st_makepoint(76.9650, 8.4004), 4326)::geography,
    true
  ),
  (
    'Radhanagar Beach',
    'radhanagar-beach',
    'Andaman and Nicobar Islands',
    'South Andaman',
    'Beach on Havelock Island in the Andaman Sea.',
    st_setsrid(st_makepoint(92.9500, 11.9830), 4326)::geography,
    true
  ),
  (
    'Puri Beach',
    'puri-beach',
    'Odisha',
    'Puri',
    'Bay of Bengal beach at Puri.',
    st_setsrid(st_makepoint(85.8312, 19.7983), 4326)::geography,
    true
  ),
  (
    'Juhu Beach',
    'juhu-beach',
    'Maharashtra',
    'Mumbai Suburban',
    'Urban beach on the Mumbai coast.',
    st_setsrid(st_makepoint(72.8265, 19.0988), 4326)::geography,
    true
  ),
  (
    'Varkala Beach',
    'varkala-beach',
    'Kerala',
    'Thiruvananthapuram',
    'Cliff-backed beach on the Arabian Sea.',
    st_setsrid(st_makepoint(76.7160, 8.7379), 4326)::geography,
    true
  ),
  (
    'Baga Beach',
    'baga-beach',
    'Goa',
    'North Goa',
    'North Goa beach near the Baga creek.',
    st_setsrid(st_makepoint(73.7517, 15.5557), 4326)::geography,
    true
  ),
  (
    'Digha Beach',
    'digha-beach',
    'West Bengal',
    'Purba Medinipur',
    'Bay of Bengal beach in coastal West Bengal.',
    st_setsrid(st_makepoint(87.5170, 21.6260), 4326)::geography,
    true
  ),
  (
    'Mahabalipuram Beach',
    'mahabalipuram-beach',
    'Tamil Nadu',
    'Chengalpattu',
    'Coromandel Coast beach near Mahabalipuram.',
    st_setsrid(st_makepoint(80.1990, 12.6208), 4326)::geography,
    true
  )
on conflict (slug) do update
set
  name = excluded.name,
  state = excluded.state,
  district = excluded.district,
  description = excluded.description,
  location = excluded.location,
  is_published = excluded.is_published,
  updated_at = now();

insert into public.beach_conditions (
  beach_id,
  source,
  source_record_id,
  valid_at,
  fetched_at,
  wave_height_m,
  wind_speed_ms,
  peak_period_s,
  current_speed_ms,
  water_quality,
  status,
  risk_score,
  reason_codes,
  data_quality,
  scoring_version,
  raw_metadata
)
select
  b.id,
  'seed-baseline',
  'seed-baseline-v1-' || b.slug,
  timestamp with time zone '2026-01-01 00:00:00+00',
  timestamp with time zone '2026-01-01 00:00:00+00',
  baseline.wave_height_m,
  baseline.wind_speed_ms,
  baseline.peak_period_s,
  baseline.current_speed_ms,
  null,
  'Caution'::public.suitability_status,
  baseline.risk_score,
  array['SEED_BASELINE', 'UNVERIFIED_DATA'],
  'unknown',
  'prototype-seed-1.0',
  jsonb_build_object(
    'purpose', 'development baseline',
    'authoritative', false
  )
from public.beaches b
join (
  values
    ('marina-beach', 0.60::numeric, 4.50::numeric, 7.00::numeric, 0.20::numeric, 1),
    ('calangute-beach', 0.70::numeric, 5.00::numeric, 8.00::numeric, 0.25::numeric, 1),
    ('kovalam-beach', 0.55::numeric, 4.00::numeric, 7.50::numeric, 0.20::numeric, 1),
    ('radhanagar-beach', 0.45::numeric, 3.50::numeric, 7.00::numeric, 0.15::numeric, 0),
    ('puri-beach', 0.80::numeric, 6.00::numeric, 8.50::numeric, 0.35::numeric, 2),
    ('juhu-beach', 0.65::numeric, 5.50::numeric, 7.50::numeric, 0.30::numeric, 1),
    ('varkala-beach', 0.60::numeric, 4.50::numeric, 7.50::numeric, 0.20::numeric, 1),
    ('baga-beach', 0.65::numeric, 5.00::numeric, 8.00::numeric, 0.25::numeric, 1),
    ('digha-beach', 0.75::numeric, 5.50::numeric, 8.00::numeric, 0.30::numeric, 2),
    ('mahabalipuram-beach', 0.60::numeric, 4.50::numeric, 7.50::numeric, 0.20::numeric, 1)
) as baseline (
  slug,
  wave_height_m,
  wind_speed_ms,
  peak_period_s,
  current_speed_ms,
  risk_score
) on baseline.slug = b.slug
where not exists (
  select 1
  from public.beach_conditions existing
  where existing.beach_id = b.id
    and existing.source = 'seed-baseline'
    and existing.source_record_id = 'seed-baseline-v1-' || b.slug
);
