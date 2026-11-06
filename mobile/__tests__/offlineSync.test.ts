import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  isStaleTimestamp,
  readOfflineSnapshot,
  staleAdvisoryLabel,
  syncPublishedBeaches,
} from "../src/services/offlineSync";
import { CACHE_SCHEMA_VERSION, writeBeachCache } from "../src/lib/cache";
import type { Beach } from "../src/types/domain";

jest.mock("../src/services/beaches", () => ({
  getPublishedBeaches: jest.fn(),
}));

const beach: Beach = {
  id: "1",
  name: "Cached Beach",
  slug: "cached-beach",
  state: "Goa",
  district: "North Goa",
  latitude: 15,
  longitude: 73,
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
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

test("retrieves a versioned offline snapshot", async () => {
  await writeBeachCache([beach]);
  const snapshot = await readOfflineSnapshot();
  expect(snapshot?.schemaVersion).toBe(CACHE_SCHEMA_VERSION);
  expect(snapshot?.beaches[0].name).toBe("Cached Beach");
});

test("does not cache an empty network response", async () => {
  const { getPublishedBeaches } = jest.requireMock("../src/services/beaches") as {
    getPublishedBeaches: jest.Mock;
  };
  getPublishedBeaches.mockResolvedValueOnce([]);
  await expect(syncPublishedBeaches()).rejects.toThrow("Empty beach response");
  expect(await AsyncStorage.getItem("beach-mood:published-beaches:v2")).toBeNull();
});

test("classifies timestamps beyond the 24-hour freshness window", () => {
  const now = Date.parse("2026-11-05T12:00:00.000Z");
  expect(isStaleTimestamp("2026-11-04T11:59:59.000Z", now)).toBe(true);
  expect(isStaleTimestamp("2026-11-04T12:00:01.000Z", now)).toBe(false);
  expect(staleAdvisoryLabel(beach, now)).toContain("Outdated Advisory");
});
