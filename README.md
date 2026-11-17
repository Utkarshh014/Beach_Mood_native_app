# Beach Mood

Beach Mood is a read-mostly coastal conditions client for India. It combines
Open-Meteo forecast ingestion, rule-based RSI classification, PostGIS proximity
search, offline cache, and optional local hazard notifications. A generic
INCOIS adapter exists, but live INCOIS integration is not verified. It is decision
support only: it is not a lifeguard, rescue service, navigation instrument, or
guarantee of safety. Follow lifeguards, posted flags, local authorities, and
official warnings.

## Repository layout

- `supabase/migrations/001_initial_schema.sql`: PostGIS schema, RLS, view, and
  nearby RPC.
- `supabase/seed.sql`: published development beach catalogue and illustrative baseline
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
`INCOIS_API_TOKEN` empty. The free-data approach uses Open-Meteo Marine and
Weather forecasts for this noncommercial college project. It does not require
contacting a provider for API access. Local ingestion corrections described
below take effect on GitHub only after they are published.

INCOIS remains an optional future integration once an actual endpoint, schema,
coverage, and permitted reuse are verified. Public pages are available for
reference; they are not configured JSON API endpoints. Credentials are needed
only if a verified product requires them.

## Python ingestion

The ingestion service uses the existing `beach_conditions` and `ocean_alerts`
tables. The ingestion runner publishes a beach after a successful condition sync;
the development seed also publishes illustrative records. A
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
# Leave INCOIS_API_URL and INCOIS_API_TOKEN unset for the free Open-Meteo path.
python -m app.main
```

`OPEN_METEO_BASE_URL`, `OPEN_METEO_WEATHER_URL`, `HTTP_TIMEOUT_SECONDS`, and
`HTTP_RETRIES` are optional. Wind is fetched separately from the free Open-Meteo
Weather API. Source validity and units are checked before scoring; partial
source failures remain partial data. See `services/ingestion/SOURCE_MAPPING.md`.
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
Initial load, manual refresh, and reconnect now share snapshot validation.
Empty/malformed responses never replace the last good snapshot. Cache entries
are validated individually, storage failures are caught, and overlapping main
catalogue refreshes share one operation. Cold start loads the cache first.

Mobile and backend use a six-hour forecast window based on `valid_at`, not
`fetched_at`. The map/card/detail presentation re-evaluates expiry every 30
seconds while active and immediately on resume. Expired measurements show
current suitability unavailable; active recorded warnings remain prominent.
Favourable model forecasts show Caution while dated water-quality assessments
and automatic official-warning coverage are unavailable. This is a conservative
presentation rule; the backend water-quality/feed-health gates remain pending.
A nearby query with no results offers a return to the national catalogue.

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
   filtering and the six-hour persistent cooldown without requiring GPS. Simulation notifications
are labelled DEMO and do not suppress subsequent real hazard notifications.
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

## Free-data approach and official references

The college-project approach uses the existing Open-Meteo APIs and Supabase Free
project, with ingestion on the existing GitHub Actions workflow. No paid data
subscription is required for this approach. Open-Meteo's public service is for
noncommercial use, requires attribution, and is subject to usage limits; it is
not an unlimited or guaranteed-availability service. See
[Open-Meteo pricing and usage limits](https://open-meteo.com/en/pricing),
[marine data attribution](https://open-meteo.com/en/docs/marine-weather-api),
[Supabase Free limits](https://supabase.com/pricing), and
[GitHub Actions allowances](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

Official INCOIS information can be viewed without configuring the app's adapter:

- [Location-specific forecasts](https://incois.gov.in/oceanservices/LSF/index.html)
- [High-wave and swell-surge advisories](https://incois.gov.in/site/services/hwa.jsp)
- [Ocean-state forecast portal](https://incois.gov.in/oceanservices/osfforecast.jsp)

The beach detail screen also opens the location-specific forecast and high-wave
advisory links. Automatic ingestion of those public products is not implemented. A publicly viewable page alone does not establish a stable machine-readable
API or permission for automated reuse. Any future connector must verify both.

## Current limitations and reasons

| Limitation | Reason and project consequence |
|---|---|
| Automatic INCOIS warnings are not integrated. | No endpoint and source contract have been verified. Open-Meteo forecasts cannot be presented as INCOIS warnings; a lack of stored warnings does not establish that no official warning exists. |
| Water quality does not affect the current score. | There is no verified live assessment feed or implemented report-import pipeline. Calm waves and wind do not establish bathing-water quality. A future official-report import must retain sampling dates and show unavailable/expired assessments as unverified. |
| Forecasts do not resolve every beach hazard. | Open-Meteo uses model grid cells; its documentation notes limited coastal current accuracy. A surface-current forecast does not establish the absence of local rip currents. |
| Some required measurements are unavailable. | Model coverage varies. The Marina smoke check returned no peak period; local scoring now treats a missing peak period as partial/Caution instead of substituting a mean period. |
| Suitability thresholds are project assumptions. | The RSI rules have unit tests but have not received coastal-safety validation. The current general score does not independently validate swimming, surfing, boating, or shoreline access. Mobile guidance now avoids blanket swimming-safety claims and unsupported closure wording. |
| Updates are not real-time emergency delivery. | Ingestion is scheduled every three hours, and GitHub schedules may be delayed or dropped. A successful job can also contain stale/partial data. See [GitHub schedule behaviour](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule). |
| Source provenance and assessment validity need a richer API contract. | Mobile expiry now uses the same six-hour forecast window as the backend, but per-source validity, advisory-feed health, and dated water-quality assessments still need to be exposed consistently by the public view and nearby RPC. |
| New warnings can be missed while a user remains at a beach. | Current notifications use a saved geofence snapshot and entry events; there is no implemented remote-push path or stationary-user warning refresh. The beach-wide six-hour cooldown can also suppress a later escalation. |
| Geofence delivery is not guaranteed. | Permissions, OS lifecycle, battery settings, and region limits affect delivery. Physical-device verification is still required; simulated entries only test part of the path. |
| Concurrent database writes still have gaps. | Mobile snapshots now reject empty/malformed data and retain good cache. Backend condition writes still use check-then-insert without a matching uniqueness constraint, and multi-table updates are not atomic. Database fixes remain pending. |
| Coverage is a demonstration catalogue. | The development seed contains ten illustrative beach records rather than a verified nationwide beach inventory. Seed measurements must not be presented as live observations. |
| Free infrastructure can become unavailable. | API quotas, GitHub allowances, and Supabase Free pausing/limits apply. Local workflow edits do not improve the deployed service until published; this project does not promise continuous monitoring. |

The E2E-only simulation control now creates explicitly labelled in-memory DEMO
warnings and notifications, with a separate cooldown from real hazards. It does
not import warnings into the live database or establish live INCOIS integration. This project currently demonstrates forecast-based
decision support, not full compliance with the original INCOIS-based solution.

## Local implementation progress

The updated ingestion workflow serializes runs and writes a data-health summary;
a successful process does not imply that every measurement is current or complete.
An empty beach catalogue fails ingestion. Workflow edits take effect only after
publication to GitHub; local edits do not change the currently deployed service.
