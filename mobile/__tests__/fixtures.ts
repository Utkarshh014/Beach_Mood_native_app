import type { Beach } from "../src/types/domain";

export function beach(overrides: Partial<Beach> = {}): Beach {
  return {
    id: "marina-1",
    name: "Marina Beach",
    slug: "marina-beach",
    state: "Tamil Nadu",
    district: "Chennai",
    latitude: 13.05,
    longitude: 80.28,
    parameters: {
      waveHeightM: 0.8,
      windSpeedMs: 5,
      peakPeriodS: 8,
      currentSpeedMs: 0.2,
      waterQuality: null,
    },
    status: "Safe",
    riskScore: 0,
    reasonCodes: [],
    dataQuality: "good",
    validAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    scoringVersion: "test",
    activeAlerts: [],
    ...overrides,
  };
}
