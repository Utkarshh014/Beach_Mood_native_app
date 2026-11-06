# Copilot instructions for Beach Mood

## Repository shape

Beach Mood is a read-mostly coastal-conditions app for India. Changes usually
span one or more of these boundaries:

- `mobile/` is the Expo React Native TypeScript client. `App.tsx` mounts the
  map screen; domain types, services, hooks, cache handling, and geofencing
  live under `mobile/src/`. Jest tests are in `mobile/__tests__/`, and Maestro
  flows are in `mobile/e2e/`.
- `services/ingestion/` is the Python ingestion job. Source adapters fetch and
  normalize marine data into Pydantic models, the RSI scorer assigns status,
  risk score, reason codes, and data quality, and the Supabase repository
  upserts conditions and advisories. `app.main` runs the scheduled job.
- `supabase/` contains the authoritative SQL migration, seed data, and SQL
  checks. The schema uses PostGIS geography, a public latest-status view, a
  nearby-beaches RPC, and RLS/public read-only access.
- `.github/workflows/quality-gate.yml` runs backend tests and mobile
  typecheck, Expo Doctor, Jest, and optional Maestro smoke tests.
  `.github/workflows/ingest.yml` runs backend tests before ingestion on a
  three-hour schedule or manual dispatch.

The runtime flow is: scheduled Python adapters -> Pydantic validation and unit
normalization -> versioned RSI scoring -> Supabase/PostGIS -> Supabase REST/RPC
-> mobile UI, with AsyncStorage fallback and optional local geofence
notifications. The mobile app must never receive the Supabase service-role key.

## Commands

Run commands from the component directory shown:

```bash
# Python ingestion
cd services/ingestion
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=. pytest -q
PYTHONPATH=. pytest tests/test_scoring.py -q
PYTHONPATH=. pytest -q -k "fallback"
PYTHONPATH=. python -m app.main

# Expo mobile app
cd mobile
npm ci
npm run typecheck
npm test
npm test -- __tests__/geofenceService.test.ts
npm test -- --testNamePattern="offline"
npx expo-doctor
npx expo start
npx expo run:ios
npx expo run:android
npm run test:e2e
```

The mobile package currently has no dedicated lint script or lint
configuration. `mobile/AGENTS.md` treats `npx expo lint` as the expected Expo
lint check when available; run it before completion if the local Expo setup
supports it. CI's required mobile checks are typecheck, Expo Doctor, Jest, and
Maestro flow-file validation, with device E2E conditional on
`MAESTRO_DEVICE_ID`.

For Supabase changes, apply `supabase/migrations/001_initial_schema.sql` in a
non-production project, seed with `supabase/seed.sql` when needed, and run
`supabase/tests/001_phase1.sql`. Validate RLS with anon credentials and inspect
the PostGIS query plan using `EXPLAIN (ANALYZE, BUFFERS)`.

## Cross-cutting conventions

- Treat upstream data as untrusted. Source adapters map provider-specific
  fields and units into canonical models; timestamps must be timezone-aware
  ISO-8601 UTC values. Preserve missing numeric values as `null`, never zero.
- Keep the RSI behavior explicit and reviewable. Update
  `SCORING_VERSION` when scoring semantics change, retain reason codes and
  data-quality metadata, and let active warning/emergency advisories override
  ordinary condition scoring.
- Ingestion uses bounded retries for source reads, falls back from configured
  INCOIS to Open-Meteo Marine, preserves the last good snapshot on per-beach
  failure, and exits non-zero if any beach fails. Do not invent an INCOIS
  endpoint or source contract; document verified mappings in
  `services/ingestion/SOURCE_MAPPING.md`.
- The public data contract is the `beach_public_status` view and
  `get_nearby_beaches` RPC. Coordinates are stored as PostGIS
  `geography(Point, 4326)` with longitude as X and latitude as Y; nearby
  queries must validate coordinates/radius and keep the indexed
  `ST_DWithin` predicate usable.
- Mobile API/cache code maps nullable and unknown values explicitly. Empty or
  malformed network responses must not overwrite a valid cache. Offline,
  missing, and stale data are distinct UI states; data older than 24 hours is
  labeled as an outdated advisory and is never presented as safe.
- Keep network access in service modules and stateful orchestration in hooks.
  Use the domain types in `mobile/src/types/domain.ts`, keep units in names
  such as `waveHeightM` and `windSpeedMs`, and avoid `any`.
- Status must not rely on color alone: pair Safe/Caution/Hazard with text,
  icons/shapes, timestamps, source attribution, and the safety disclaimer.
  Preserve manual browsing when location permission is denied.
- Geofencing is opt-in and native-build dependent. Foreground location is
  requested only after a user action; background location is requested only
  when hazard alerts are enabled. Keep the region list bounded, process only
  enter events, persist the registry/cooldown, and do not claim notification
  delivery is guaranteed.

## Mobile-specific guidance

Before changing Expo, React Native, EAS, or native-module behavior, read the
Expo major version in `mobile/package.json` and consult the matching versioned
Expo docs. Follow `mobile/AGENTS.md` for the detailed Expo rules. In
particular, use `npx expo install` for Expo-compatible dependencies, do not
hand-edit generated `ios/` or `android/` directories, and use a development
build rather than Expo Go for maps, background location, and geofencing.

For map performance, preserve memoized marker components/props, avoid
recreating marker arrays and callbacks unnecessarily, and use
`tracksViewChanges={false}` for static marker artwork unless deliberately
remounting/updating it.

## Source of truth

Read the relevant design contract before changing behavior:

- `README.md` for setup, deployment, offline behavior, and verification.
- `docs/ARCHITECTURE.md` for component responsibilities and failure behavior.
- `docs/API.md` for mobile/Python data contracts.
- `docs/DATABASE.md` and `supabase/migrations/001_initial_schema.sql` for SQL,
  RLS, and spatial behavior.
- `docs/DESIGN.md` for safety UX and accessibility requirements.
- `docs/ENGINEERING_GUIDELINES.md` for TypeScript, map, permission, and
  geofence patterns.
- `mobile/AGENTS.md` and `mobile/CLAUDE.md` for mobile-agent instructions.
