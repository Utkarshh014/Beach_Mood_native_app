import { isBeachStale, staleAdvisoryLabel } from "../src/services/offlineSync";
import type { Beach } from "../src/types/domain";

const beach: Beach = {
  id: "1",
  name: "Test Beach",
  slug: "test-beach",
  state: "Goa",
  district: "North Goa",
  latitude: 15,
  longitude: 73,
  parameters: {
    waveHeightM: 1,
    windSpeedMs: 4,
    peakPeriodS: 8,
    currentSpeedMs: 0.2,
    waterQuality: null,
  },
  status: "Caution",
  riskScore: 1,
  reasonCodes: [],
  dataQuality: "good",
  validAt: "2026-11-02T10:00:00.000Z",
  fetchedAt: "2026-11-02T10:00:00.000Z",
  scoringVersion: "test",
  activeAlerts: [],
};

test("classifies conditions older than 24 hours as stale", () => {
  const now = Date.parse("2026-11-03T11:00:01.000Z");
  expect(isBeachStale(beach, now)).toBe(true);
  expect(staleAdvisoryLabel(beach, now)).toContain("Outdated Advisory");
});

test("does not classify a recent condition as stale", () => {
  const now = Date.parse("2026-11-03T09:00:00.000Z");
  expect(isBeachStale(beach, now)).toBe(false);
  expect(staleAdvisoryLabel(beach, now)).toBeNull();
});
