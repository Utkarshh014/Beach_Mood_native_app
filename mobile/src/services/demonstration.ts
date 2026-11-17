import type { Beach } from "../types/domain";

/** In-memory presentation fixture only; never written to the live beach cache. */
export function demonstrationBeach(beach: Beach, now = Date.now()): Beach {
  return {
    ...beach,
    status: "Hazard",
    activeAlerts: [{
      id: `demo-${beach.id}`, type: "demo", severity: "warning",
      title: "Demonstration warning — not a live INCOIS alert",
      description: "Test data for demonstrating notification delivery only.",
      startsAt: new Date(now).toISOString(), endsAt: new Date(now + 3_600_000).toISOString(),
      source: "demo", sourceUrl: null,
    }],
  };
}
