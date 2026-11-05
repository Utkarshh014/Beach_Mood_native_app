# Beach Mood

Beach Mood is a read-mostly coastal conditions client for India. It combines
official-source ingestion, conservative RSI classification, PostGIS proximity
search, offline cache, and optional local hazard notifications. It is decision
support only: it is not a lifeguard, rescue service, navigation instrument, or
guarantee of safety. Follow lifeguards, posted flags, local authorities, and
official warnings.

## Repository layout

- `supabase/migrations/001_initial_schema.sql`: PostGIS schema, RLS, view, and
  nearby RPC.
- `supabase/seed.sql`: unpublished development beach catalogue and baseline
  records.
- `services/ingestion`: Python/Pydantic ingestion and RSI service.
- `mobile`: Expo React Native TypeScript client.
- `.github/workflows/ingest.yml`: three-hour scheduled ingestion workflow.

## Documentation & System Design

- [Product Requirements Document (PRD)](docs/PRD.md)
- [System Architecture](docs/ARCHITECTURE.md)
- [Database Schema & PostGIS Functions](docs/DATABASE.md)
- [API Specification](docs/API.md)
- [Design Guidelines & UI Architecture](docs/DESIGN.md)
- [Engineering Guidelines](docs/ENGINEERING_GUIDELINES.md)
- [Project Roadmap](docs/ROADMAP.md)

## Supabase setup

1. Create a free Supabase project.
2. Ensure the PostGIS extension is available in the project.
3. Open the Supabase SQL Editor and run
   `supabase/migrations/001_initial_schema.sql`.
4. Run `supabase/seed.sql` for initial phone testing. It publishes the ten
   catalogue records, but their coordinates and baseline values are not
   authoritative observations or safety advice. They should remain visibly
   treated as baseline/stale until live ingestion succeeds.
5. Verify anonymous `SELECT` access to published records and verify anonymous
   `INSERT`, `UPDATE`, and `DELETE` fail.
6. Run `supabase/tests/001_phase1.sql` in a non-production project. Inspect the
   `EXPLAIN (ANALYZE, BUFFERS)` output for the GiST spatial index.

The mobile app receives only the public URL and anon key. Never put the
service-role key in the mobile app or a committed `.env` file.

### First deployment source

The first deployment intentionally leaves `INCOIS_API_URL` and
`INCOIS_API_TOKEN` empty. The ingestion service uses the Open-Meteo Marine
fallback until a verified INCOIS product and credentials are supplied.

## Python ingestion

The ingestion service uses the existing `beach_conditions` and `ocean_alerts`
tables. It publishes a beach only after a successful condition sync. A
configured INCOIS endpoint is primary; Open-Meteo Marine is the fallback
context source when INCOIS is unavailable. The project deliberately does not
invent an INCOIS endpoint: verify the selected product, terms, schema, cadence,
and advisory semantics before configuring it.

```bash
cd services/ingestion
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
export INCOIS_API_URL="https://verified-endpoint.example"
export INCOIS_API_TOKEN="optional-token"
python -m app.main
```

`OPEN_METEO_BASE_URL`, `HTTP_TIMEOUT_SECONDS`, and `HTTP_RETRIES` are optional.
The runner exits non-zero if any beach fails while preserving the last good
condition snapshot.

### GitHub Actions

Add these repository secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INCOIS_API_URL` (only after verifying the endpoint)
- `INCOIS_API_TOKEN` (only when required by that source)

The workflow at `.github/workflows/ingest.yml` runs tests and ingestion every
three hours, and can also be started with `workflow_dispatch`.

## Run the Expo app

```bash
cd mobile
cp .env.example .env
# Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.
npm install
npm run typecheck
npm test
npx expo start
```

For native maps, background location, and geofencing, use a development build;
Expo Go and simulators cannot fully represent production background behavior:

```bash
npx expo run:ios
npx expo run:android
```

The first native build requires Xcode/Android tooling or an equivalent EAS
development build environment. Location is requested only after the user taps
`Locate Me`. Background location is requested only after enabling hazard alerts.

## Offline and stale-data behavior

The client stores a versioned AsyncStorage snapshot containing full beach
records, latest RSI values, and active alerts. It loads that snapshot when
network requests fail and refreshes silently when NetInfo reports connectivity.
Empty or malformed responses never overwrite a good snapshot.

Conditions or alerts older than 24 hours are labeled:
**Outdated Advisory - Proceed with Extreme Caution**. Missing data is never
treated as safe. A nearby query with no results offers a return to the national
catalogue.

## Geofence demonstration

1. Install a development build on a physical device.
2. Grant foreground location, then enable `Enable Hazard Alerts`.
3. Use a Supabase record with current `Hazard` status or an active official
   alert and register its 2.5 km region.
4. On iOS Simulator use **Features > Location > Custom Location**; on an
   Android emulator use the Extended Controls location panel. Simulators may
   not deliver background geofence callbacks reliably.
5. For deterministic unit-level verification, call
   `simulateGeofenceEntry(beach, now)` from
   `mobile/src/services/geofenceService.ts`. The helper exercises hazard
   filtering and the six-hour persistent cooldown without requiring GPS.
6. Verify that a second entry for the same beach within six hours does not
   schedule another notification.

Geofence delivery depends on OS permissions, device settings, app lifecycle,
battery policy, and platform region limits. It is not guaranteed.

## Verification commands

```bash
cd services/ingestion
PYTHONPATH=. pytest -q

cd mobile
npm run typecheck
npm test
npx expo-doctor
```

Maestro end-to-end flows and local emulator/device setup are documented in
[`mobile/e2e/README.md`](mobile/e2e/README.md). The deterministic hazard flow
uses `EXPO_PUBLIC_E2E=true` and the in-app simulation control; production
builds do not expose that control.

Before release, review the INCOIS terms and source mapping, have RSI thresholds
reviewed by qualified coastal-safety experts, test RLS with anon credentials,
test offline cold launch and corrupted cache, test accessibility with screen
readers, and validate geofencing on physical iOS and Android devices.
