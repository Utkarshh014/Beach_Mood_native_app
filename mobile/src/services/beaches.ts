import { supabase } from "../lib/supabase";
import type {
  AlertSeverity,
  Beach,
  DataQuality,
  OceanAlert,
  SuitabilityStatus,
} from "../types/domain";

interface NearbyBeachRow {
  id: string;
  name: string;
  slug: string;
  state: string;
  district: string | null;
  latitude: number;
  longitude: number;
  distance_meters: number;
  status: SuitabilityStatus | null;
  valid_at: string | null;
  fetched_at: string | null;
  wave_height_m: number | null;
  wind_speed_ms: number | null;
  peak_period_s: number | null;
  current_speed_ms: number | null;
  water_quality: string | null;
  risk_score: number | null;
  reason_codes: string[] | null;
  data_quality: DataQuality | null;
  active_alerts: unknown;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function status(value: unknown): SuitabilityStatus | null {
  return value === "Safe" || value === "Caution" || value === "Hazard"
    ? value
    : null;
}

function quality(value: unknown): DataQuality {
  return value === "good" ||
    value === "partial" ||
    value === "stale" ||
    value === "unknown"
    ? value
    : "unknown";
}

function alerts(value: unknown): OceanAlert[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    if (typeof item !== "object" || item === null) return [];
    const row = item as Record<string, unknown>;
    const severity = row.severity;
    if (
      typeof row.id !== "string" ||
      typeof row.type !== "string" ||
      (severity !== "info" &&
        severity !== "watch" &&
        severity !== "warning" &&
        severity !== "emergency") ||
      typeof row.title !== "string" ||
      typeof row.starts_at !== "string" ||
      typeof row.source !== "string"
    ) {
      return [];
    }
    return [
      {
        id: row.id,
        type: row.type,
        severity: severity as AlertSeverity,
        title: row.title,
        description: typeof row.description === "string" ? row.description : null,
        startsAt: row.starts_at,
        endsAt: typeof row.ends_at === "string" ? row.ends_at : null,
        source: row.source,
        sourceUrl: typeof row.source_url === "string" ? row.source_url : null,
      },
    ];
  });
}

function mapRow(row: Record<string, unknown>): Beach {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    state: String(row.state),
    district: typeof row.district === "string" ? row.district : null,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    distanceMeters: nullableNumber(row.distance_meters) ?? undefined,
    parameters: {
      waveHeightM: nullableNumber(row.wave_height_m),
      windSpeedMs: nullableNumber(row.wind_speed_ms),
      peakPeriodS: nullableNumber(row.peak_period_s),
      currentSpeedMs: nullableNumber(row.current_speed_ms),
      waterQuality:
        typeof row.water_quality === "string" ? row.water_quality : null,
    },
    status: status(row.status),
    riskScore: nullableNumber(row.risk_score),
    reasonCodes: Array.isArray(row.reason_codes)
      ? row.reason_codes.filter((code): code is string => typeof code === "string")
      : [],
    dataQuality: quality(row.data_quality),
    validAt: typeof row.valid_at === "string" ? row.valid_at : null,
    fetchedAt: typeof row.fetched_at === "string" ? row.fetched_at : null,
    scoringVersion:
      typeof row.scoring_version === "string" ? row.scoring_version : null,
    activeAlerts: alerts(row.active_alerts),
  };
}

export async function getPublishedBeaches(): Promise<Beach[]> {
  const { data, error } = await supabase
    .from("beach_public_status")
    .select("*");
  if (error) throw new Error(`Beach data failed: ${error.message}`);
  return (data ?? []).map((row) =>
    mapRow(row as unknown as Record<string, unknown>),
  );
}

export async function getNearbyBeaches(
  latitude: number,
  longitude: number,
  radiusMeters: number,
): Promise<Beach[]> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: "get_nearby_beaches",
    args: { lat: number; lon: number; radius_meters: number },
  ) => Promise<{ data: NearbyBeachRow[] | null; error: { message: string } | null }>;
  const { data, error } = await rpc("get_nearby_beaches", {
    lat: latitude,
    lon: longitude,
    radius_meters: radiusMeters,
  });
  if (error) throw new Error(`Nearby beaches failed: ${error.message}`);
  return (data ?? []).map((row) =>
    mapRow(row as unknown as Record<string, unknown>),
  );
}
