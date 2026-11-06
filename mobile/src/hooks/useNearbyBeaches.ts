import { useCallback, useEffect, useState } from "react";

import { getNearbyBeaches } from "../services/beaches";
import type { Beach, UserLocation } from "../types/domain";

export const DEFAULT_RADIUS_METERS = 50_000;

export function useNearbyBeaches(location: UserLocation | null) {
  const [beaches, setBeaches] = useState<Beach[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!location) {
      setBeaches([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setBeaches(
        await getNearbyBeaches(
          location.latitude,
          location.longitude,
          DEFAULT_RADIUS_METERS,
        ),
      );
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Nearby beaches are unavailable right now.",
      );
      setBeaches([]);
    } finally {
      setLoading(false);
    }
  }, [location]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { beaches, loading, error, refresh };
}
