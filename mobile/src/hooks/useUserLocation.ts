import { useCallback, useState } from "react";
import * as Location from "expo-location";

import type { UserLocation } from "../types/domain";

export type LocationPermissionState =
  | "unknown"
  | "requesting"
  | "granted"
  | "denied"
  | "unavailable";

interface LocationState {
  location: UserLocation | null;
  foregroundPermission: LocationPermissionState;
  backgroundPermission: LocationPermissionState;
  tracking: boolean;
  error: string | null;
}

export function useUserLocation() {
  const [state, setState] = useState<LocationState>({
    location: null,
    foregroundPermission: "unknown",
    backgroundPermission: "unknown",
    tracking: false,
    error: null,
  });

  const requestForegroundLocation = useCallback(async () => {
    setState((current) => ({
      ...current,
      foregroundPermission: "requesting",
      error: null,
    }));
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setState((current) => ({
          ...current,
          foregroundPermission: "denied",
          tracking: false,
          error:
            "Location permission is needed for nearby beaches. You can still browse the national map.",
        }));
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
      setState((current) => ({
        ...current,
        location,
        foregroundPermission: "granted",
        tracking: true,
        error: null,
      }));
      return location;
    } catch (cause: unknown) {
      setState((current) => ({
        ...current,
        foregroundPermission: "unavailable",
        tracking: false,
        error:
          cause instanceof Error
            ? cause.message
            : "Could not determine your location. Browse the map manually.",
      }));
      return null;
    }
  }, []);

  const requestBackgroundPermission = useCallback(async () => {
    if (state.foregroundPermission !== "granted") {
      const foreground = await requestForegroundLocation();
      if (!foreground) return false;
    }
    try {
      const permission = await Location.requestBackgroundPermissionsAsync();
      setState((current) => ({
        ...current,
        backgroundPermission: permission.granted ? "granted" : "denied",
        error: permission.granted
          ? null
          : "Background location was not enabled. The map and nearby search still work.",
      }));
      return permission.granted;
    } catch {
      setState((current) => ({
        ...current,
        backgroundPermission: "unavailable",
        error:
          "Background geofencing is unavailable here. You can continue using nearby search.",
      }));
      return false;
    }
  }, [requestForegroundLocation, state.foregroundPermission]);

  return {
    ...state,
    requestForegroundLocation,
    requestBackgroundPermission,
  };
}
