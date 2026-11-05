-- Run after 001_initial_schema.sql and seed.sql in a non-production test project.
-- The SQL editor executes as an owner, so RLS behavior itself must also be
-- checked through Supabase anon and service credentials.

do $$
begin
  begin
    perform * from public.get_nearby_beaches(91, 80, 50000);
    raise exception 'Expected invalid latitude to fail';
  exception
    when sqlstate '22023' then null;
  end;

  begin
    perform * from public.get_nearby_beaches(13.05, 80.28, 0);
    raise exception 'Expected invalid radius to fail';
  exception
    when sqlstate '22023' then null;
  end;
end;
$$;

select
  count(*) = 10 as has_expected_seed_count
from public.beaches
where slug in (
  'marina-beach',
  'calangute-beach',
  'kovalam-beach',
  'radhanagar-beach',
  'puri-beach',
  'juhu-beach',
  'varkala-beach',
  'baga-beach',
  'digha-beach',
  'mahabalipuram-beach'
);

select
  array_agg(slug order by distance_meters) as ordered_slugs,
  bool_and(distance_meters >= 0) as nonnegative_distances
from public.get_nearby_beaches(13.05, 80.28, 50000);

explain (analyze, buffers)
select id
from public.beaches
where is_published = true
  and st_dwithin(
    location,
    st_setsrid(st_makepoint(80.2837, 13.0500), 4326)::geography,
    25000
  );
