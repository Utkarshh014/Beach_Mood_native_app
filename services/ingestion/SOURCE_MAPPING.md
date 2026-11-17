# Phase 2 source mapping

## INCOIS

INCOIS publishes multiple products and does not provide one universal schema
for every marine bulletin or OPeNDAP product. The service therefore requires
the operator to configure a confirmed JSON endpoint in `INCOIS_API_URL`; it
does not fabricate an endpoint or claim that a product is authoritative without
source review.

The adapter sends `latitude` and `longitude` query parameters and accepts a
JSON object, or an object under `data`. Canonical fields and supported aliases:

| Canonical value | Accepted fields |
|---|---|
| Significant wave height (m) | `wave_height_m`, `significant_wave_height`, `hs` |
| Swell height (m) | `swell_height_m`, `swell_wave_height` |
| Peak/swell period (s) | `peak_period_s`, `swell_period`, `peak_period` |
| Wind speed (m/s) | `wind_speed_ms`, `wind_speed`, `wind_speed_mps` |
| Current speed (m/s) | `current_speed_ms`, `ocean_current_velocity`, `current_speed` |
| Valid time | `valid_at`, `validAt`, `timestamp` |

Advisories may be supplied in a top-level `alerts` or `advisories` array with
`id`, `alert_type`/`type`, `severity`, `title`, `description`, `starts_at`,
`ends_at`, and `source_url`.

The configured endpoint and its field mapping must be verified against the
selected INCOIS product, terms, cadence, and alert semantics before production.

## Open-Meteo fallback

Two free, noncommercial endpoints are used:

- Marine: `https://marine-api.open-meteo.com/v1/marine` requests
  `wave_height`, `swell_wave_height`, `swell_wave_peak_period`, and
  `ocean_current_velocity`.
- Weather: `https://api.open-meteo.com/v1/forecast` requests
  `wind_speed_10m` with `wind_speed_unit=ms`.

Both request UTC hourly data. Each selects the latest timestamp at or before
fetch evaluation time, rather than midnight or a future forecast. Missing,
malformed, or unordered timestamps invalidate that component. Response units
are checked: lengths must be metres, periods seconds, and velocities are
converted from m/s, km/h, mph, or knots to m/s. Nonfinite/negative values and
misaligned arrays invalidate the component. Missing measurements remain null.

Marine and weather validity timestamps, response units, and grid coordinates
are retained separately in `raw_metadata.components`. The oldest component
controls the combined `valid_at`, so newer wind cannot renew an old wave
forecast. `fetched_at` records download completion only. A failed component is
listed in `raw_metadata.unavailable_components`; the other source can still
provide partial context. Failure of both components raises an error and the
runner preserves the existing database snapshot.

A mean swell period is not substituted for a missing peak period. Some models
and locations return null peak periods; missing peak period now forces partial
quality and at least Caution. These are contextual forecasts, not emergency
advisories or a water-quality assessment.

Reference documentation:
- https://open-meteo.com/en/docs/marine-weather-api
- https://open-meteo.com/en/docs

## INCOIS readiness

The canonical adapter remains unverified against a real INCOIS product. No
endpoint or credential was invented. Observation time must be explicit,
timezone-aware, and not in the future. Empty core measurements are rejected so
the runner can use the fallback. Advisory schema, geographic scope, units, and
cancellation semantics still require verification before enabling live INCOIS.
