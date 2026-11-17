import type { Beach } from "../types/domain";

type Row = Record<string, unknown>;
function record(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function numberOrNull(value: unknown): boolean {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}
function timeOrNull(value: unknown): boolean {
  return value === null || (typeof value === "string" && Number.isFinite(Date.parse(value)));
}

export function isBeach(value: unknown): value is Beach {
  if (!record(value) || !record(value.parameters)) return false;
  const p = value.parameters;
  return [value.id, value.name, value.slug, value.state].every(text) &&
    (value.district === null || typeof value.district === "string") &&
    typeof value.latitude === "number" && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90 &&
    typeof value.longitude === "number" && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180 &&
    (value.distanceMeters === undefined || numberOrNull(value.distanceMeters)) &&
    [p.waveHeightM, p.windSpeedMs, p.peakPeriodS, p.currentSpeedMs].every(numberOrNull) &&
    (p.waterQuality === null || typeof p.waterQuality === "string") &&
    [null, "Safe", "Caution", "Hazard"].includes(value.status as string | null) &&
    ["good", "partial", "stale", "unknown"].includes(value.dataQuality as string) &&
    numberOrNull(value.riskScore) &&
    Array.isArray(value.reasonCodes) && value.reasonCodes.every(text) &&
    timeOrNull(value.validAt) && timeOrNull(value.fetchedAt) &&
    (value.scoringVersion === null || text(value.scoringVersion)) &&
    Array.isArray(value.activeAlerts) && value.activeAlerts.every((a) =>
      record(a) && [a.id, a.type, a.title, a.source].every(text) &&
      ["info", "watch", "warning", "emergency"].includes(a.severity as string) &&
      text(a.startsAt) && timeOrNull(a.startsAt) && timeOrNull(a.endsAt) &&
      (a.endsAt === null || Date.parse(a.endsAt as string) > Date.parse(a.startsAt as string)) &&
      (a.description === null || typeof a.description === "string") &&
      (a.sourceUrl === null || typeof a.sourceUrl === "string"));
}

export function isBeachSnapshot(value: unknown): value is Beach[] {
  return Array.isArray(value) && value.length > 0 && value.every(isBeach) &&
    new Set(value.map((b) => b.id)).size === value.length;
}
