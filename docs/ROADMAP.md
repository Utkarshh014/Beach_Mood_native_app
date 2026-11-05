# Beach Mood — Phased Implementation Roadmap

The phases are ordered to reduce integration risk. Each phase includes deliverables, verification gates, and a self-contained prompt suitable for an AI coding assistant or developer handoff.

## Phase 1 — Database, PostGIS and seed catalogue

### Deliverables
- Supabase project with PostGIS enabled.
- Migration containing beaches, conditions, alerts, indexes, public status view, RLS and `get_nearby_beaches`.
- Verified seed catalogue with validated coordinates.
- SQL tests for coordinate validation, radius validation and distance ordering.

### Steps
1. Create Supabase project and enable PostGIS.
2. Apply `docs/DATABASE.md` DDL as a migration.
3. Add only verified beach coordinates; mark records unpublished until reviewed.
4. Test public anon read and confirm anonymous writes fail.
5. Test nearby RPC at known coordinates and inspect query plan.

### Exit criteria
- Migration applies cleanly to a fresh database.
- RLS behavior is verified using anon and service credentials.
- Spatial query returns expected distances and uses the GiST index at representative volume.

### Development prompt
> Implement Phase 1 of Beach Mood using the locked stack and the supplied `docs/DATABASE.md`. Create a Supabase migration and seed script. Do not change the schema contract. Enable PostGIS, create beaches, beach_conditions and ocean_alerts, add GiST and lookup indexes, create the public status view and `get_nearby_beaches(lat, lon, radius_meters)` RPC using geography and ST_DWithin. Add RLS and deny public writes. Validate latitude/longitude/radius inputs. Include repeatable SQL tests or a documented test script for invalid inputs, distance ordering, published-only visibility, and anonymous write denial. Do not fabricate beach boundaries or claim seed coordinates are authoritative. Return files changed, commands run, and unresolved Supabase-version compatibility checks.

## Phase 2 — Python ingestion and RSI engine

### Deliverables
- Python package with Pydantic canonical models.
- One adapter per confirmed INCOIS feed and optional Open-Meteo Marine adapter.
- Unit normalization, source provenance and timestamp handling.
- Deterministic RSI engine with versioned thresholds.
- Idempotent Supabase upsert and alert synchronization.
- GitHub Actions cron with secrets.

### Steps
1. Identify exact INCOIS endpoints, schema, licensing/terms, cadence and alert semantics.
2. Capture representative fixtures and document source fields/units.
3. Implement adapters and Pydantic validation.
4. Implement RSI scoring and unit tests.
5. Upsert snapshots by beach/source/valid time; do not erase last good data on failure.
6. Schedule ingestion and expose last-success timestamp.

### Exit criteria
- Fixture tests pass for each source.
- Missing fields produce Caution/unknown data, never false Safe.
- Active official warning overrides all computed results.
- Duplicate runs are idempotent.
- Failed source run preserves last good snapshot.

### Development prompt
> Implement Phase 2 in `services/ingestion` using Python, Pydantic and Supabase. Keep the canonical models and RSI rules in `docs/API.md` and `docs/PRD.md`. First inspect and document the actual selected INCOIS endpoint schemas; do not invent endpoints or fields. Build separate source adapters, normalize all timestamps to UTC and all values to canonical SI units, validate with Pydantic, and preserve nulls for missing data. Implement a pure, deterministic RSI function with a scoring version and reason codes. Active official warning/emergency advisories must force Hazard; watch must force at least Caution; stale/missing core data must not become Safe. Add pytest tests for all boundaries, missing values, stale data, active/expired alerts, and malformed input. Implement idempotent Supabase synchronization using secrets from environment variables. Add a GitHub Actions scheduled workflow, bounded retries, non-zero exit on failed sync, and a clear run summary. Do not put service-role credentials in the mobile app. Provide fixture-based tests and a source-data mapping document.

## Phase 3 — Expo client, map and detail UI

### Deliverables
- Expo managed TypeScript app with NativeWind and Reanimated.
- Supabase public client.
- Map markers and beach detail screen.
- Loading, empty, stale, offline and permission-denied states.
- Type-safe domain models.

### Steps
1. Initialize Expo project with a pinned SDK.
2. Install compatible versions of `react-native-maps`, NativeWind, Reanimated and Supabase client.
3. Configure Babel/Metro/Tailwind per installed versions.
4. Build map and memoized marker.
5. Read `beach_public_status` and display detail.
6. Add status explanations, source and freshness metadata.

### Exit criteria
- Physical iOS/Android builds load the map.
- No API secrets beyond public anon credentials are embedded.
- Map handles 0, 1 and many beaches; markers are accessible.
- No false Safe state when data is missing.

### Development prompt
> Implement Phase 3 of Beach Mood in `apps/mobile` using Expo managed workflow, TypeScript, NativeWind, Reanimated, react-native-maps and Supabase. Do not replace the locked stack. Pin mutually compatible package versions for the selected Expo SDK and document installation commands. Configure NativeWind/Reanimated correctly for those versions. Implement the map screen, memoized status markers, beach summary sheet and detail screen using the types in `docs/API.md`. Read only the public Supabase status contract. Display Safe/Caution/Hazard/Unknown distinctly, with status text, reason codes, source and timestamps. Add loading, empty, offline, stale and error states. Do not request location on app launch. Add component tests for state rendering and ensure marker props remain stable. Provide a physical-device verification checklist.

## Phase 4 — Nearby search, geofencing and local notifications

### Deliverables
- Foreground location hook.
- Nearby beaches RPC integration and radius filter.
- User-controlled geofence opt-in.
- Limited region registration and local notifications.
- Deduplication and permission recovery.

### Steps
1. Request foreground location in response to “Nearby”.
2. Call PostGIS RPC with coordinates and radius.
3. Explain background permission and request only after explicit opt-in.
4. Add TaskManager task and geofence registration.
5. Select only a bounded set of relevant nearby beaches.
6. Deduplicate notification events and refresh regions on foreground.

### Exit criteria
- Manual browse works when permission is denied.
- Nearby distances are plausible and sorted.
- Geofence entry creates one local notification in device testing.
- OS limits and failure modes are documented.

### Development prompt
> Implement Phase 4 without changing the stack. Use expo-location, expo-task-manager and expo-notifications with a development build. Add a foreground-only location hook and nearby RPC integration using `get_nearby_beaches`. Ask for background location only after the user explicitly enables hazard approach alerts and sees an explanation. Define the background task at module scope, register only a bounded set of nearby relevant regions, and use stable beach IDs. On Enter, confirm the region maps to a current beach record, suppress duplicate alerts with durable local storage and schedule a local notification. Do not send remote push notifications. Handle denied/revoked permission, disabled location services, app restart and OS region limits. Clearly document platform-specific app config and test on physical iOS and Android devices. Never promise guaranteed geofence delivery.

## Phase 5 — Offline persistence, hardening and verification

### Deliverables
- AsyncStorage or expo-sqlite cache.
- Cache schema/versioning and refresh strategy.
- Offline and stale banners.
- End-to-end tests and release checklist.
- Safety/privacy review and operational runbook.

### Steps
1. Cache catalogue and latest status snapshots after successful fetch.
2. Add `cached_at`, source `fetched_at`, `valid_at`, and schema version.
3. Load cache first; refresh in background when connected.
4. Never overwrite good cache with empty/failed response.
5. Test airplane mode, stale records, corrupted cache, source outage and Supabase outage.
6. Complete safety review, privacy disclosure, accessibility and store permission review.

### Exit criteria
- Cold offline launch shows cache and its age.
- Stale records are not presented as current.
- All RSI and alert override tests pass.
- Release checklist signed by product, engineering and domain safety reviewers.

### Development prompt
> Implement Phase 5 of Beach Mood using AsyncStorage or expo-sqlite (choose one and document the choice; do not add a paid dependency). Cache the published beach catalogue and latest public condition snapshots with schema version, cache timestamp, source fetched_at and valid_at. Load cached data first, then refresh when network is available. Do not replace valid cache with failed, empty or malformed responses. Show persistent offline/stale indicators and make it impossible for old data to appear current. Add tests for offline cold start, refresh success, timeout, corrupt cache, schema migration and stale thresholds. Run the full RSI, API contract, SQL, UI and device geofence test suites. Produce a release checklist covering INCOIS source permissions, threshold/domain review, official-alert override, privacy, background location disclosures, accessibility, security, and real-device testing. Do not claim the app guarantees beach safety.

## 6. Suggested repository execution order

```bash
# Database: apply reviewed migration through Supabase CLI or SQL editor.
# Python ingestion
cd services/ingestion
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest

# Mobile
cd ../../apps/mobile
npm install
npx expo start
```

## 7. Release checklist

- [ ] Exact INCOIS feeds and usage permissions documented.
- [ ] Source adapters tested against recorded fixtures.
- [ ] Thresholds reviewed by qualified domain experts.
- [ ] Official emergency advisories override RSI.
- [ ] No missing/stale data is classified as Safe.
- [ ] Public RLS and anonymous write denial verified.
- [ ] No service-role key in app bundle or repository.
- [ ] Geofence tested on physical devices and limitations disclosed.
- [ ] Offline cache freshness is prominent.
- [ ] Accessibility, privacy and store disclosures reviewed.
- [ ] Coordinates and geofence radii validated by local experts.
