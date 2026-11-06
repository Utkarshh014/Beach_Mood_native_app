import type { Beach } from "../types/domain";

const initial = [
  ["marina-beach", "Marina Beach", "Tamil Nadu", "Chennai", 13.05, 80.2837],
  ["calangute-beach", "Calangute Beach", "Goa", "North Goa", 15.544, 73.7553],
  ["kovalam-beach", "Kovalam Beach", "Kerala", "Thiruvananthapuram", 8.4004, 76.965],
  ["puri-beach", "Puri Beach", "Odisha", "Puri", 19.7983, 85.8312],
  ["juhu-beach", "Juhu Beach", "Maharashtra", "Mumbai Suburban", 19.0988, 72.8265],
] as const;

export const initialBeaches: Beach[] = initial.map(
  ([slug, name, state, district, latitude, longitude]) => ({
    id: `initial-${slug}`,
    name,
    slug,
    state,
    district,
    latitude,
    longitude,
    parameters: {
      waveHeightM: null,
      windSpeedMs: null,
      peakPeriodS: null,
      currentSpeedMs: null,
      waterQuality: null,
    },
    status: null,
    riskScore: null,
    reasonCodes: ["DATA_UNAVAILABLE"],
    dataQuality: "unknown",
    validAt: null,
    fetchedAt: null,
    scoringVersion: null,
    activeAlerts: [],
  }),
);
