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

## Open-Meteo Marine fallback

The fallback requests `wave_height`, `swell_wave_height`, `swell_wave_period`,
`wind_speed_10m`, and `ocean_current_velocity` from the official marine API.
Open-Meteo values are normalized to the canonical SI units used by the
database: metres, seconds, and metres per second. It is a contextual fallback,
not an authority for emergency advisories.
