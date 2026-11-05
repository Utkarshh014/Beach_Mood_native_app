# Beach Mood — Engineering Guidelines

## 1. TypeScript and React Native standards

- Enable `strict: true`; avoid `any`. Use `unknown` at untrusted boundaries and validate.
- Prefer functional components and small domain-focused components.
- Keep network access in service modules and stateful orchestration in hooks.
- Use stable keys and memoize marker components/derived data.
- Do not put secrets in source control or `EXPO_PUBLIC_*` variables except genuinely public values.
- Keep units in names (`waveHeightM`, `windSpeedMs`).
- All timestamps are ISO-8601 UTC strings at API boundaries.
- Handle nulls explicitly.

## 2. Map performance

- Memoize marker components and marker props.
- Use `tracksViewChanges={false}` for static marker artwork after initial render; if marker contents change dynamically, temporarily enable tracking or remount deliberately.
- Do not recreate marker arrays or callback functions unnecessarily.
- Avoid placing complex React trees inside every marker.
- Consider clustering for high-density regions.
- Test on physical low/mid-tier Android devices as well as iOS.
- Use `initialRegion` for first render; avoid repeatedly controlling the full map region unless user interaction requires it.

## 3. Permissions

1. Request foreground location only after a user action that benefits from it.
2. Explain the feature before showing the OS prompt.
3. If denied, preserve manual map and search functionality.
4. Request background permission only when the user enables geofence alerts and after a clear explanation.
5. Respect iOS/Android platform differences and current Expo SDK configuration.
6. Geofencing requires a development build and platform configuration; verify exact requirements for the pinned Expo SDK.

## 4. Canonical code template: Supabase client

```ts
// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error("Missing public Supabase configuration");
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
```

## 5. Canonical code template: performant map marker

```tsx
// src/components/map/BeachMarker.tsx
import React, { memo } from "react";
import { Marker } from "react-native-maps";
import { View, Text } from "react-native";
import type { Beach } from "../../types/domain";

type Props = {
  beach: Beach;
  onPress: (beach: Beach) => void;
};

function markerColor(status: Beach["status"]): string {
  if (status === "Safe") return "#22c55e";
  if (status === "Caution") return "#eab308";
  if (status === "Hazard") return "#ef4444";
  return "#64748b";
}

function BeachMarkerComponent({ beach, onPress }: Props) {
  return (
    <Marker
      identifier={beach.id}
      coordinate={{ latitude: beach.latitude, longitude: beach.longitude }}
      onPress={() => onPress(beach)}
      tracksViewChanges={false}
      accessibilityLabel={`${beach.name}, ${beach.status ?? "status unavailable"}`}
    >
      <View
        style={{
          minWidth: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: markerColor(beach.status),
          borderWidth: 2,
          borderColor: "#ffffff",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 11 }}>
          {beach.status === "Safe" ? "S" : beach.status === "Caution" ? "!" : beach.status === "Hazard" ? "H" : "?"}
        </Text>
      </View>
    </Marker>
  );
}

export const BeachMarker = memo(BeachMarkerComponent);
```

If marker child updates are not reflected due to `tracksViewChanges={false}`, key/remount the marker on status change or use a controlled tracking window. Verify actual behavior on both native providers.

## 6. Canonical code template: user location hook

```ts
// src/hooks/useUserLocation.ts
import { useCallback, useState } from "react";
import * as Location from "expo-location";
import type { UserLocation } from "../types/domain";

type LocationState =
  | { status: "idle" | "requesting" }
  | { status: "denied"; message: string }
  | { status: "error"; message: string }
  | { status: "ready"; location: UserLocation };

export function useUserLocation() {
  const [state, setState] = useState<LocationState>({ status: "idle" });

  const requestLocation = useCallback(async () => {
    setState({ status: "requesting" });
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setState({
          status: "denied",
          message: "Location permission is needed for nearby beaches. You can still browse the map.",
        });
        return null;
      }

      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const location: UserLocation = {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
        accuracyMeters: result.coords.accuracy,
        capturedAt: new Date(result.timestamp).toISOString(),
      };

      setState({ status: "ready", location });
      return location;
    } catch {
      setState({ status: "error", message: "Could not determine your location. Try again or browse manually." });
      return null;
    }
  }, []);

  return { state, requestLocation };
}
```

## 7. Canonical code template: nearby beaches hook

```ts
// src/hooks/useNearbyBeaches.ts
import { useCallback, useState } from "react";
import type { Beach } from "../types/domain";
import { getNearbyBeaches } from "../services/beaches";

export function useNearbyBeaches() {
  const [beaches, setBeaches] = useState<Beach[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNearby = useCallback(async (
    latitude: number,
    longitude: number,
    radiusMeters: number
  ) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getNearbyBeaches(latitude, longitude, radiusMeters);
      setBeaches(result);
      return result;
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Unable to load nearby beaches");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return { beaches, loading, error, loadNearby };
}
```

## 8. Geofence implementation checklist

- Use `Location.startGeofencingAsync` with a registered task defined at module scope via `TaskManager.defineTask`.
- Add `expo-task-manager` and configure background location in app config.
- Configure iOS background location usage strings and Android foreground/background permissions according to current Expo docs.
- Schedule local notifications with `Notifications.scheduleNotificationAsync`.
- Deduplicate entries by beach ID and time window using durable local storage.
- Keep region count within documented OS limits and refresh when the app foregrounds.
- Test app termination, reboot, permission changes, battery saver, and location disabled.
- Do not claim guaranteed delivery.

## 9. Testing standards

- Unit test RSI thresholds, alert overrides, missing data and stale data.
- Contract-test each upstream adapter with recorded fixtures.
- SQL test invalid coordinates/radii and proximity ordering.
- Component-test map empty/loading/error/status states.
- Device-test geofence behavior on supported iOS/Android versions.
- Test offline cold start and cache corruption.
- Add regression fixtures for every production incident.

## 10. Environment and secrets

Mobile `.env`:
```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Ingestion secrets (GitHub Actions repository secrets):
```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
INCOIS_API_BASE_URL
INCOIS_API_TOKEN   # only if the selected feed requires one
OPEN_METEO_BASE_URL
```

Never commit real credentials. If a source is genuinely open and unauthenticated, do not invent a token requirement.
