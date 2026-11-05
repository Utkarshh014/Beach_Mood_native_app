# Beach Mood — Product Requirements Document

**Version:** 1.0  
**Status:** Engineering baseline / MVP specification  
**Domain:** Coastal tourism and recreational safety in India  
**Primary data source:** INCOIS official open data and advisories; Open-Meteo Marine is a fallback/context source, not an authority for emergency warnings.

## 1. Executive summary

Beach Mood helps visitors understand the current recreational conditions at Indian beaches. It combines marine and meteorological observations/forecasts with official hazard advisories and presents a conservative status: **Safe**, **Caution**, or **Hazard**. The product includes a map, beach details, nearby-beach discovery, geofence-triggered local alerts, and cached information for low-connectivity coastal areas.

This is a decision-support product, not a lifeguard, rescue service, navigation instrument, or guarantee of safety. Conditions can change quickly and local hazards may not be represented by available data. The interface must always direct users to obey lifeguards, local authorities, posted flags, and official warnings.

### Objectives

1. Make current beach-condition information understandable at a glance.
2. Apply a deterministic and auditable Recreation Suitability Index (RSI).
3. Surface official emergency advisories above model-derived status.
4. Help users discover beaches within a chosen radius.
5. Warn users locally when they enter a configured hazardous beach region.
6. Preserve the last successfully synchronized data for offline viewing, with clear freshness labels.

### Success measures

| Measure | MVP target |
|---|---:|
| Beach map first useful render on a warm cache | < 2 seconds on representative mid-range device |
| Nearby query response, server-side | p95 < 500 ms for indexed query under agreed test load |
| Client crash-free sessions | >= 99% during pilot |
| Ingestion freshness | Visible timestamp; target cadence configured per source |
| Hazard override correctness | 100% of seeded official emergency-alert test cases |
| Offline state clarity | Every cached record shows observation/update time and stale state |

Targets are engineering goals to validate in a pilot, not guarantees.

## 2. Personas

### Casual tourist
Wants to know whether swimming or beach recreation appears advisable before travelling. Needs simple language, distance, timestamp, and clear caveats.

### Water-sports enthusiast
Needs wave height, peak period, wind, and activity-specific context. Understands that a general beach status is not a substitute for operator/local assessment.

### Coastal safety patrol / local administrator
Needs to view beach conditions and official advisories quickly. MVP is read-only for public users; privileged advisory ingestion and data correction remain server-side.

## 3. Scope

### In scope
- India beach catalogue with coordinates and administrative metadata.
- Map with Safe/Caution/Hazard markers.
- Beach detail sheet with available ocean parameters, source, timestamps, alerts, and status explanation.
- Nearby beach lookup using PostGIS.
- State/activity/distance filters.
- Local geofence notifications for a limited set of nearby monitored beaches.
- Offline cache of beach catalogue and latest condition snapshot.
- Python ingestion/scoring pipeline and Supabase synchronization.

### Out of scope for MVP
- User-generated incident reporting and social features.
- Lifeguard dispatch, emergency calling workflows, or rescue coordination.
- Payment, bookings, reviews, or tourism marketplace.
- Guaranteed real-time sensor coverage at every beach.
- Medical or individualized risk advice.
- Background geofencing for every beach in India (mobile OS region limits apply).

## 4. Core user journeys

1. **Open map:** app loads cached beaches immediately, then refreshes from Supabase; markers show status and freshness.
2. **Inspect beach:** user selects a marker and sees status, explanation, wave height, period, wind, alerts, source and update time.
3. **Find nearby:** user grants foreground location; app requests beaches within a radius and sorts by distance.
4. **Filter:** user selects state, activity, status, and distance; results update without changing the underlying safety calculation.
5. **Approach hazard:** if background location and notification permissions are granted, the OS reports entry into a monitored geofence and the app displays a local notification.
6. **Offline use:** app displays cached catalogue and conditions, marks them as stale after the freshness threshold, and does not imply that stale data represents current conditions.

## 5. Functional requirements / user stories

| ID | User story | Acceptance criteria |
|---|---|---|
| FR-01 | As a tourist, I want to see beaches on a map so I can compare locations. | Markers use status colors; loading, empty and error states exist. |
| FR-02 | As a tourist, I want a clear status so I can quickly understand conditions. | Status, reason codes, and last-updated time are visible. |
| FR-03 | As a user, I want nearby beaches so I can discover options. | Foreground permission is requested contextually; radius is configurable. |
| FR-04 | As a user, I want detailed ocean data so I can understand the rating. | Available values include units, source, and timestamp. Missing values are explicitly shown as unavailable. |
| FR-05 | As a user, I want hazard alerts when approaching a beach. | Geofence notification is local, permission-gated, deduplicated, and clearly names the beach. |
| FR-06 | As a user, I want the app to work offline. | Cached records are available and visibly labelled with their age. |
| FR-07 | As an operator, I want data ingestion to be auditable. | Each snapshot stores source, fetched time, valid time, and scoring version. |
| FR-08 | As an operator, I want official alerts to override computed status. | Active emergency alert forces Hazard regardless of numeric RSI. |

## 6. MoSCoW prioritization

| Priority | Features |
|---|---|
| Must | Beach catalogue; status map; deterministic RSI; official alert override; detail view; nearby query; data freshness; local cache; graceful permissions/network handling |
| Should | Filters; limited geofencing; source provenance; scoring explanation; retry/backoff and ingestion monitoring |
| Could | Marker clustering; activity-specific guidance; saved beaches; multilingual copy; richer historical charts |
| Won't for MVP | Crowdsourced safety claims; rescue dispatch; guaranteed live sensor feeds; user accounts; booking/payment |

## 7. RSI decision model

### 7.1 Important safety boundary

The following thresholds are **provisional product heuristics for an MVP prototype**, not official INCOIS thresholds, legal swimming standards, or validated safety limits. Before public deployment, the thresholds must be reviewed by qualified coastal/ocean-safety experts and local authorities, calibrated against beach-specific conditions, and approved through a documented safety process. Do not describe a beach as objectively safe. Prefer wording such as “No elevated hazard detected in available data.”

The app must never downgrade an active official warning. Missing data must never be interpreted as safe.

### 7.2 Inputs and units

- Significant wave height `Hs`: metres.
- Sustained/mean wind speed: metres/second.
- Peak wave period `Tp`: seconds.
- Official alerts: normalized alert type, severity, active interval, source and source identifier.
- Optional current speed: metres/second; optional water-quality state from a trusted source.
- `valid_at`: time the data describes; `fetched_at`: time our service retrieved it.

### 7.3 Numeric baseline

For each available parameter, assign risk points. The thresholds below are deliberately conservative starting points and require validation.

| Parameter | Safe points 0 | Caution points 1 | Hazard points 3 |
|---|---:|---:|---:|
| Hs | < 0.5 m | 0.5–1.0 m | > 1.0 m |
| Wind speed | < 5 m/s | 5–10 m/s | > 10 m/s |
| Peak period | < 8 s | 8–12 s | > 12 s |
| Current speed (if available) | < 0.3 m/s | 0.3–0.6 m/s | > 0.6 m/s |

A long-period swell can carry substantial energy even when wave height is modest; therefore `Tp > 12s` contributes hazard points. These are generic screening thresholds, not beach-specific surf forecasts.

### 7.4 Classification

Let `R` be the sum of available parameter risk points.

- **Hazard** if any active official emergency advisory exists; or any available parameter is in the Hazard band; or `R >= 3`.
- **Caution** if `1 <= R < 3`; or any required core parameter is missing/stale.
- **Safe** only if all configured core inputs are present and fresh, no active advisory exists, all available parameters are in the Safe band, and the source coverage policy is satisfied.

If the data is stale beyond the configured maximum age (default prototype: 6 hours for forecast/current-condition feed; source-specific policy may differ), classify as **Caution — data stale** unless an active alert requires Hazard. The UI must distinguish “Caution due to conditions” from “Caution due to insufficient/stale data”.

### 7.5 Alert override

Normalize official advisories to `info`, `watch`, `warning`, `emergency`. For MVP:
- Active `warning` or `emergency` for tsunami, storm surge, high waves, swell surge, dangerous currents, or other designated coastal emergency => Hazard.
- Active `watch` => at least Caution.
- An expired alert does not override status, but remains in history if retained.
- Alert validity is evaluated using UTC timestamps; ingestion records original source text and normalized category.
- Source failures do not clear an already active official alert. Expiry is based on the official validity interval, not a failed fetch.

### 7.6 Output and explanation

The RSI is an explainable risk score, not a probability. Persist:
- `status`, `risk_score`, `reason_codes`, `scoring_version`,
- input values and their timestamps,
- `computed_at`, `valid_at`, `source`, `data_quality`.

Example reason codes: `WAVE_CAUTION`, `WIND_HAZARD`, `LONG_PERIOD_SWELL`, `ACTIVE_OFFICIAL_WARNING`, `MISSING_WIND`, `STALE_DATA`.

### 7.7 Water quality

Do not infer water quality from weather or ocean state. Only include it when an authoritative measurement source, measurement timestamp, units, and quality classification are available. Until then display “Water quality data unavailable”; do not assign a safe state.

## 8. Non-functional requirements

- **Performance:** cached map should render promptly; fetch only visible/nearby records where practical; paginate large catalogues.
- **Battery:** foreground location only while needed; background geofencing only after explicit opt-in; avoid continuous GPS polling.
- **Offline:** cache latest beach catalogue and snapshots; show timestamps and stale warning; no offline status recalculation unless all required inputs and scoring version are available locally.
- **Security:** public client uses Supabase anon key with RLS; never embed service-role key; ingestion credentials stored in GitHub Actions secrets.
- **Reliability:** ingestion is idempotent; retries use exponential backoff; failed ingestion does not overwrite good data with nulls.
- **Accessibility:** status is conveyed with text/icon as well as color; touch targets and screen-reader labels are provided.
- **Privacy:** location is used for nearby results/geofencing; do not persist precise user location by default.
- **Observability:** structured ingestion logs, source latency, record counts, validation failures and last-success timestamps.
- **Compatibility:** validate Expo SDK, native module compatibility, and background-location requirements on physical iOS/Android devices.

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Incomplete or delayed data | Show source and age; stale => Caution; never equate missing with safe |
| Incorrect generic thresholds | Expert review, pilot calibration, versioned scoring, conservative defaults |
| OS geofence limits / app termination | Monitor only nearest subset; explain OS limitations; test real devices |
| Source schema changes | Adapter layer, Pydantic validation, contract tests |
| Public misinterpretation | Strong disclaimers, no “guaranteed safe” wording, emergency override |
| Offline stale warning missed | Persistent stale banner and last-sync timestamp |

## 10. Release gate

Do not release publicly until source terms/permissions, data provenance, alert semantics, thresholds, privacy disclosures, background-location justification, device tests, and safety review are complete.
