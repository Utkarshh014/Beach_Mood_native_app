import { displayStatus, currentAlerts } from "../src/services/suitability";
import { isBeachStale, STALE_AFTER_MS } from "../src/services/offlineSync";
import { beach } from "./fixtures";

const now = Date.parse("2026-11-17T12:00:00Z");
const record = () => beach({ validAt: new Date(now).toISOString(), fetchedAt: new Date(now).toISOString() });

test("favourable forecasts cannot establish swimming suitability without coverage", () => {
  expect(displayStatus(record(), now)).toBe("Caution");
});

test("a fresh download cannot renew an old forecast", () => {
  const b = { ...record(), validAt: new Date(now - STALE_AFTER_MS - 1).toISOString() };
  expect(isBeachStale(b, now)).toBe(true);
  expect(displayStatus(b, now)).toBeNull();
});

test("future and missing validity are unverified", () => {
  expect(displayStatus({ ...record(), validAt: new Date(now + 1).toISOString() }, now)).toBeNull();
  expect(displayStatus({ ...record(), validAt: null }, now)).toBeNull();
});

test("expiry changes presentation without changing the stored score", () => {
  const b = record();
  expect(displayStatus(b, now)).toBe("Caution");
  expect(displayStatus(b, now + STALE_AFTER_MS + 1)).toBeNull();
  expect(b.status).toBe("Safe");
});

test("active warning remains visible over stale measurements; expired warning does not", () => {
  const b = { ...record(), validAt: null, activeAlerts: [{
    id: "warning", type: "storm_surge", title: "Storm surge", severity: "warning" as const,
    startsAt: new Date(now - 1000).toISOString(), endsAt: new Date(now + 1000).toISOString(),
    source: "test", sourceUrl: null, description: null,
  }] };
  expect(displayStatus(b, now)).toBe("Hazard");
  expect(currentAlerts(b, now + 1000)).toEqual([]);
  expect(displayStatus(b, now + 1000)).toBeNull();
});
