import type { Beach, OceanAlert, SuitabilityStatus } from "../types/domain";
import { isBeachStale } from "./offlineSync";

export const INCOIS_UNAVAILABLE = "Automatic INCOIS warnings unavailable. Check official advisories before visiting.";

export function currentAlerts(beach: Beach, now = Date.now()): OceanAlert[] {
  return beach.activeAlerts.filter((alert) => {
    const start = Date.parse(alert.startsAt);
    const end = alert.endsAt === null ? null : Date.parse(alert.endsAt);
    return Number.isFinite(start) && start <= now &&
      (end === null || (Number.isFinite(end) && end > now));
  });
}

export function displayStatus(beach: Beach, now = Date.now()): SuitabilityStatus | null {
  // Active recorded warnings stay visible even when forecast measurements expire.
  if (currentAlerts(beach, now).some((a) => a.severity === "warning" || a.severity === "emergency")) return "Hazard";
  if (isBeachStale(beach, now) || beach.dataQuality === "stale" || beach.dataQuality === "unknown") return null;
  if (beach.status === "Hazard") return "Hazard";
  if (beach.status === null) return null;
  // Until dated water assessments and an official feed-health contract exist,
  // favourable model forecasts alone cannot establish overall suitability.
  return "Caution";
}

export function guidanceFor(beach: Beach, now = Date.now()): string {
  const status = displayStatus(beach, now);
  if (status === "Hazard") return "Avoid water activities. Follow official advisories and lifeguard instructions.";
  if (status === null) return "Current suitability unavailable. Do not rely on old or unverified measurements.";
  return "Use caution. Forecasts alone do not verify swimming safety; water quality and official warning coverage are unverified.";
}

const REASONS: Record<string, string> = {
  ACTIVE_OFFICIAL_WARNING: "Recorded warning affects this location",
  WAVE_HAZARD: "Elevated wave height", WAVE_CAUTION: "Wave height calls for caution",
  WIND_HAZARD: "Strong winds", WIND_CAUTION: "Wind calls for caution",
  CURRENT_HAZARD: "Strong surface currents", CURRENT_CAUTION: "Current calls for caution",
  LONG_PERIOD_SWELL: "Long-period swell", STALE_DATA: "Forecast has expired",
  MISSING_WAVE_HEIGHT: "Wave height unavailable", MISSING_WIND: "Wind unavailable",
  MISSING_CURRENT: "Current unavailable", MISSING_PEAK_PERIOD: "Peak period unavailable",
  INCOMPLETE_CORE_DATA: "Required measurements are incomplete",
  SEED_BASELINE: "Demonstration baseline", UNVERIFIED_DATA: "Unverified data",
  DATA_UNAVAILABLE: "Live conditions unavailable",
};
export function explainReason(code: string): string {
  return REASONS[code] ?? code.toLowerCase().replaceAll("_", " ");
}
