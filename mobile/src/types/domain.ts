export type SuitabilityStatus = "Safe" | "Caution" | "Hazard";
export type DataQuality = "good" | "partial" | "stale" | "unknown";
export type AlertSeverity = "info" | "watch" | "warning" | "emergency";

export interface OceanParameters {
  waveHeightM: number | null;
  windSpeedMs: number | null;
  peakPeriodS: number | null;
  currentSpeedMs: number | null;
  waterQuality: string | null;
  windDirectionDeg?: number | null;
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
  dataQuality: DataQuality;
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
