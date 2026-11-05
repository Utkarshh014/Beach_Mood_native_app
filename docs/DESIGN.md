# Beach Mood — UI/UX & Screen Specifications

## 1. Design principles

- Safety status must be understandable without relying on color alone.
- Show timestamp and data source beside every condition summary.
- Do not use “safe to swim” as an unconditional promise.
- Hazard and official warning states must have strong visual hierarchy.
- Keep the map usable without location permission.
- Distinguish missing data, stale data, and a genuine caution condition.

## 2. Design tokens

```ts
export const colors = {
  safe: "#22c55e",
  caution: "#eab308",
  hazard: "#ef4444",
  ink: "#102A43",
  ocean: "#0B6E8A",
  sea: "#D9F0F2",
  sand: "#F6F0E5",
  surface: "#FFFFFF",
  background: "#F7FAFC",
  text: "#172B4D",
  muted: "#627D98",
  border: "#D9E2EC",
  info: "#2563EB",
};
```

Status color must always pair with text and an icon/shape:
- Safe: green + “No elevated hazard detected”
- Caution: yellow + “Use caution”
- Hazard: red + “Hazard advisory”
- Unknown/stale: neutral grey + “Data unavailable / last updated…”

## 3. Main interactive map screen

### Layout
1. Full-screen native map.
2. Top overlay: app title, search/filter control, optional current-location button.
3. Markers: status-colored custom marker with accessible label.
4. Bottom draggable summary sheet: selected beach name, status, distance, data age, primary reason.
5. Persistent banner when data is stale/offline or an official warning is active.

### Behavior
- Initial map uses cached beach data; then refreshes.
- Ask for location only when user taps “Nearby” or location button.
- Marker tap opens summary sheet; “View details” navigates to detail.
- Clustering is recommended for dense regions; if using clustering, test marker tap behavior and accessibility.
- Avoid animating all markers on every render.

## 4. Beach detail inspection sheet

Order:
1. Beach name, state/district and status.
2. Plain-language explanation and active official alert.
3. “Conditions last valid at” and “Retrieved at”.
4. Parameter cards:
   - Significant wave height (m)
   - Peak period (s)
   - Wind speed (m/s)
   - Current speed (m/s)
   - Water quality (only when a source exists)
5. Safe-activity guidance only if validated by an authoritative activity-specific model. Otherwise omit activity recommendations.
6. Source attribution and disclaimer.

Missing values appear as “Not available”; never display 0 as a substitute.

## 5. Safety advisory modal

Triggered when:
- app is foregrounded and current location is inside a hazardous monitored region, or
- local notification is tapped.

Contents:
- “Hazard advisory near [Beach]”
- hazard category, issuing authority/source, valid interval and last retrieval time
- concise instruction: “Follow local authorities and lifeguard instructions. Avoid entering the water when an official warning is active.”
- dismiss action; do not hide persistent map hazard state.

Do not fabricate evacuation or rescue instructions. Display source-provided instructions only when the source content is verified and current.

## 6. Search and filters

- Search by beach name, district, or state.
- State selector.
- Status filter (Safe/Caution/Hazard/Unknown).
- Distance radius (e.g. 5, 10, 25, 50 km).
- Activity filter is deferred until activity-specific suitability rules exist. A general RSI cannot reliably determine suitability for swimming, surfing, boating, etc.

## 7. Loading, error and offline states

| State | UI |
|---|---|
| Loading | Map shell + subtle progress indicator |
| Empty | “No beaches found in this area” + adjust radius |
| Offline with cache | Map + persistent “Offline — showing data from [time]” |
| Offline without cache | Connection guidance; do not show fabricated statuses |
| Stale data | “Conditions last updated [time]. Treat as unverified.” |
| No permission | Map works; nearby/geofence features explain permission requirement |
| Hazard | Persistent high-contrast alert with text, source and validity |

## 8. Accessibility

- Minimum practical touch target 44x44 points.
- Dynamic type and screen-reader labels.
- Status text must accompany color.
- Respect reduced-motion preferences for Reanimated transitions.
- Ensure map controls are reachable without gestures alone.
