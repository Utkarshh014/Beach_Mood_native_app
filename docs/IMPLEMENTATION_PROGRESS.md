# Implementation progress — 17 November 2026

## Completed locally: current-condition ingestion and workflow hardening

1. Split Open-Meteo Marine and Weather requests; wind no longer depends on an
   undocumented Marine variable. Added optional `OPEN_METEO_WEATHER_URL` to
   settings, the example environment file, and the ingestion workflow.
2. Select the latest valid forecast hour, never the first midnight record or a
   future hour. Reject absent, malformed, duplicate, or unordered timestamps.
3. Validate units and normalize velocities to m/s. Reject invalid numbers and
   misaligned arrays; leave missing measurements null.
4. Request actual swell peak period. Do not substitute mean period. Missing peak
   period now makes scoring partial/Caution; bumped scoring version.
5. Fetch the two independent sources concurrently. Preserve usable partial
   context if one fails; reject entirely unusable results so previous database
   snapshots survive.
6. Retain separate marine/weather timestamps, units, grid coordinates, and
   unavailable components in existing raw metadata. Combined validity uses the
   older component; download completion does not renew forecast validity.
7. Require explicit timezone-aware, currently valid observation timestamps in
   the generic INCOIS adapter; reject all-null core measurements. No real INCOIS
   integration is claimed or enabled.
8. Fail ingestion when the beach catalogue is unexpectedly empty.
9. Add log/Actions data-health summaries: catalogue/success/failure counts,
   stale/partial counts, source, validity, reasons, and unavailable components.
10. Serialize ingestion workflow jobs with `cancel-in-progress: false` so active
    jobs finish. GitHub may replace pending runs; this is not a durable job queue.
11. Upgrade ingestion actions to Node 24 releases: checkout v7 and setup-python
    v6. Keep the existing three-hour schedule and read-only repository permission.
12. Update source mapping/README and add regression tests for the above cases.

## Verification

- Backend suite: 41 tests pass locally.
- Read-only Open-Meteo smoke check at Marina: both endpoints responded; observed
  peak period was unavailable. No Supabase access/write in this check.
- For the first batch, no new paid services, dependencies, GitHub push, workflow dispatch, deployment,
  or database migration was performed.
- GitHub runtime compatibility/concurrency still needs an actual run after the
  user elects to publish. It cannot be established by local unit tests.

## Remaining steps (not represented as completed)

1. Verify actual permitted free INCOIS product access, advisory schemas,
   geographic coverage, severity, and cancellation semantics. If unavailable,
   keep live integration incomplete. The second batch adds a labelled E2E-only
   in-memory demonstration fixture. No agency contact is planned.
2. Independent advisory synchronization, cancellation/expiry reconciliation, and
   last-checked feed health. Never clear warnings on a failed/partial response.
3. Structured, dated water-quality imports and conservative suitability rules.
4. Expose actual forecast-source provenance and separate source validity in the
   mobile API contract. Mobile expiry, readable reasons, and activity wording
   were implemented in the second batch below.
5. Persisted alert opt-in/out, current region refresh, warning/revision deduplication,
   stationary-user checks, and free Android push delivery via existing ingestion.
6. Database atomicity and uniqueness migration; bounded historical retention
   and future contract/cache-version updates. Main-catalogue cache validation,
   refresh coalescing, and storage failures are handled in the second batch.
7. Physical Android verification, native map credentials, offline/recovery checks,
   and end-to-end source-to-notification demonstration.

The checked cloud runs use Open-Meteo with INCOIS unset. Existing scoring still
lacks water-quality and advisory-feed-availability gates; this batch must not be
presented as completion of the overall recreational-suitability project.


## Completed locally: side-chat direction, mobile freshness and cache

The supplied side-chat screenshot establishes the no-contact/no-payment route:
use Open-Meteo; link to official INCOIS products; keep automatic INCOIS ingestion
unverified; use clearly labelled demonstrations. Do not email agencies or invent
an INCOIS endpoint. Existing README limitations from the side chat were retained
and updated where this batch changes the behaviour.

Changes in this batch:

1. Unified forecast expiry at six hours based on valid time; future/missing
   times are unverified. Added a foreground clock and immediate resume check.
2. Centralized presentation rules used by markers, cards, and details. Expired
   forecasts become unavailable. Active recorded warnings stay prominent.
   Favourable forecasts remain Caution until water-quality/official-feed coverage
   can support a positive overall recommendation. Stored backend scores are not
   rewritten by the presentation policy.
3. Updated marker keys when display status changes, and resolve open cards/details
   from the latest fetched catalogue instead of keeping a stale selected object.
4. Replaced unsupported swimming/water-sports and prohibition claims in details,
   the hazard modal, and notification body. Added readable reasons, validity and
   download times, explicit unverified water quality, and unavailable INCOIS copy.
5. Added in-app official forecast/advisory links with link-opening error handling.
   An official website link is not represented as an integrated warning feed.
6. Added validation of individual beach records, dates, coordinates, parameters,
   and alert structure, plus duplicate-ID checks for snapshots. The old v2 cache
   format remains compatible; malformed old data is ignored.
7. Shared initial/manual/reconnect fetch validation. Empty/malformed responses
   cannot overwrite good snapshots. Cold start reads cache first. Storage failures
   do not throw out fresh network results, and failed refreshes preserve newer
   in-memory data. Main-catalogue overlapping requests are coalesced; unmount
   cleanup prevents late state updates. Resume also refreshes the catalogue.
8. Labelled E2E simulation data and notifications DEMO; generate the fixture only
   in memory, even without a real Hazard beach. Demo cooldowns are separate from
   real hazards. Updated the Maestro expected wording; no device flow was run.
9. Added free Expo-compatible ESLint dev dependencies/config and a lint script
   because no linter existed. Updated the lockfile. Fixed a type-style warning
   and notification enum imports; narrowly documented the existing external-query
   loading effect so React lint does not misclassify its intended state update.
10. Added regression tests for expiry, missing coverage, warning intervals, bad
    cache/storage, cache-first launch, overlapping/failed refreshes, demo isolation,
    and the foreground clock. Updated the old 24-hour tests and guidance assertions.

Still pending: actual source provenance in the mobile contract, dated water
assessment imports/backend gates, source-specific warning health and lifecycle,
notification opt-in/region/deduplication/background improvements, nearby-query
races, database migrations/atomicity/retention, and physical-device verification.
Nothing was pushed or deployed, and no database writes were made in this batch.

Second-batch verification: mobile typecheck and ESLint pass; 34 mobile tests and
41 backend tests pass. `git diff --check` passes. Native UI, external-link opening,
Maestro flows, and notification delivery still require a physical-device run.
