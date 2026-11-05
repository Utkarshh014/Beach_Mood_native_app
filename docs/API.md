# Beach Mood — API Specification & Data Contracts

## 1. API surface

The Expo client uses Supabase PostgREST and RPC over HTTPS. The Python ingestion process writes using a server-side credential. FastAPI is optional and must not expose privileged writes publicly.

| Operation | Method / route | Parameters | Success | Common errors |
|---|---|---|---|---|
| List public beaches | GET `/rest/v1/beach_public_status` | `select=*`, optional `state=eq...` | Array of status rows | 401/403 auth/RLS; 5xx |
| Nearby beaches | POST `/rest/v1/rpc/get_nearby_beaches` | `{ "lat": number, "lon": number, "radius_meters": integer }` | Array ordered by distance | 400 invalid args; 401/403; 5xx |
| Beach detail | GET `/rest/v1/beach_public_status?id=eq.<uuid>` | beach UUID | One row | 404/empty; 5xx |
| Active alerts | GET `/rest/v1/ocean_alerts` | `beach_id=eq.<uuid>&is_active=eq.true` | Alert array | 401/403; 5xx |
| Ingestion health (optional) | GET `/health` | none | service status + last run metadata | 503 unhealthy |

Use the Supabase client SDK rather than manually assembling headers where possible. Never put service-role key in the mobile app.

## 2. TypeScript domain types

```ts
export type SuitabilityStatus = "Safe" | "Caution" | "Hazard";
export type AlertSeverity = "info" | "watch" | "warning" | "emergency";

export interface OceanParameters {
  waveHeightM: number | null;
  windSpeedMs: number | null;
  peakPeriodS: number | null;
  currentSpeedMs: number | null;
  waterQuality: string | null;
}

export interface OceanAlert {
  id: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  source: string;
  sourceUrl: string | null;
}

export interface Beach {
  id: string;
  name: string;
  slug: string;
  state: string;
  district: string | null;
  latitude: number;
  longitude: number;
  distanceMeters?: number;
  parameters: OceanParameters;
  status: SuitabilityStatus | null;
  riskScore: number | null;
  reasonCodes: string[];
  dataQuality: "good" | "partial" | "stale" | "unknown";
  validAt: string | null;
  fetchedAt: string | null;
  scoringVersion: string | null;
  activeAlerts: OceanAlert[];
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: string;
}

export interface NearbyBeachesRequest {
  lat: number;
  lon: number;
  radius_meters: number;
}
```

The `status` may be null when no condition snapshot exists. The app should present “Data unavailable” as a distinct display state, not fabricate a fourth suitability status.

## 3. Python Pydantic ingestion models

Install pinned compatible dependencies in `requirements.txt` and update pins after CI tests.

```python
from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

Severity = Literal["info", "watch", "warning", "emergency"]

class OceanObservation(BaseModel):
    model_config = ConfigDict(extra="allow")

    beach_slug: str
    source: str
    valid_at: datetime
    fetched_at: datetime
    wave_height_m: float | None = Field(default=None, ge=0, le=30)
    wind_speed_ms: float | None = Field(default=None, ge=0, le=100)
    peak_period_s: float | None = Field(default=None, ge=0, le=40)
    current_speed_ms: float | None = Field(default=None, ge=0, le=10)
    water_quality: str | None = None

    @field_validator("valid_at", "fetched_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("timestamps must include timezone")
        return value.astimezone(timezone.utc)

class OceanAdvisory(BaseModel):
    model_config = ConfigDict(extra="allow")

    source: str
    source_alert_id: str
    beach_slug: str
    alert_type: str
    severity: Severity
    title: str
    description: str | None = None
    starts_at: datetime
    ends_at: datetime | None = None
    source_url: str | None = None

    @field_validator("starts_at", "ends_at")
    @classmethod
    def normalize_time(cls, value: datetime | None) -> datetime | None:
        if value is not None:
            if value.tzinfo is None:
                raise ValueError("timestamps must include timezone")
            return value.astimezone(timezone.utc)
        return value
```

Source adapters must map the actual upstream field names and units into these canonical models. Do not assume that every INCOIS feed exposes the same schema; each feed needs a documented adapter and contract fixture.

## 4. Error and fallback contract

| Condition | Backend behavior | Client behavior |
|---|---|---|
| Missing Hs/wind/period | Preserve null; add missing reason code; status at least Caution | Show “Unavailable”, not zero |
| Source timeout | Bounded retry; retain last good snapshot; record failed run | Use cache and show last updated |
| Source returns malformed payload | Reject affected record; log validation error | Continue displaying previous snapshot as stale |
| Supabase write failure | Exit non-zero; do not report success | Refresh later |
| No network | No request; use local cache | Offline banner + timestamps |
| No GPS permission | No nearby request | Map/manual browse remains available |
| Empty beach result | Return empty array | Helpful empty state |

Suggested HTTP client timeouts: connect 5 seconds, read 20 seconds; retry 2–3 times with exponential backoff and jitter for idempotent GET requests only. Respect source rate limits and terms.

## 5. Supabase client mapping example

```ts
import { supabase } from "../lib/supabase";
import type { Beach } from "../types/domain";

export async function getNearbyBeaches(
  latitude: number,
  longitude: number,
  radiusMeters: number
): Promise<Beach[]> {
  const { data, error } = await supabase.rpc("get_nearby_beaches", {
    lat: latitude,
    lon: longitude,
    radius_meters: radiusMeters,
  });

  if (error) throw new Error(`Nearby beaches failed: ${error.message}`);
  return (data ?? []).map(mapNearbyRow);
}

function mapNearbyRow(row: Record<string, unknown>): Beach {
  // In production, validate `row` with a runtime schema before mapping.
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    state: String(row.state),
    district: row.district == null ? null : String(row.district),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    distanceMeters: Number(row.distance_meters),
    parameters: {
      waveHeightM: nullableNumber(row.wave_height_m),
      windSpeedMs: nullableNumber(row.wind_speed_ms),
      peakPeriodS: nullableNumber(row.peak_period_s),
      currentSpeedMs: nullableNumber(row.current_speed_ms),
      waterQuality: row.water_quality == null ? null : String(row.water_quality),
    },
    status: isStatus(row.status) ? row.status : null,
    riskScore: nullableNumber(row.risk_score),
    reasonCodes: Array.isArray(row.reason_codes) ? row.reason_codes.map(String) : [],
    dataQuality: isQuality(row.data_quality) ? row.data_quality : "unknown",
    validAt: row.valid_at == null ? null : String(row.valid_at),
    fetchedAt: row.fetched_at == null ? null : String(row.fetched_at),
    scoringVersion: null,
    activeAlerts: Array.isArray(row.active_alerts) ? row.active_alerts as Beach["activeAlerts"] : [],
  };
}

function nullableNumber(value: unknown): number | null {
  return value == null ? null : Number(value);
}
function isStatus(value: unknown): value is Beach["status"] {
  return value === "Safe" || value === "Caution" || value === "Hazard";
}
function isQuality(value: unknown): value is Beach["dataQuality"] {
  return value === "good" || value === "partial" || value === "stale" || value === "unknown";
}
```

The example illustrates the contract; replace the broad `Record` mapper with generated Supabase database types and runtime validation before production.

## 6. Optional FastAPI health endpoint

```python
from datetime import datetime, timezone
from fastapi import FastAPI

app = FastAPI(title="Beach Mood Ingestion Health", version="1.0.0")

@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "beach-mood-ingestion",
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
```

This endpoint reports process health only; it does not prove upstream data freshness. Add last-success metadata from durable storage before using it as an operational dashboard.
