import { useCallback, useEffect, useState } from "react";

import { initialBeaches } from "../data/initialBeaches";
import { readBeachCache, writeBeachCache } from "../lib/cache";
import { getPublishedBeaches } from "../services/beaches";
import {
  subscribeToConnectivity,
  syncPublishedBeaches,
} from "../services/offlineSync";
import type { Beach } from "../types/domain";

interface BeachesState {
  beaches: Beach[];
  loading: boolean;
  error: string | null;
  isCached: boolean;
  cachedAt: string | null;
  refresh: () => Promise<void>;
  offline: boolean;
}

export function useBeaches(): BeachesState {
  const [beaches, setBeaches] = useState<Beach[]>(initialBeaches);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fresh = await getPublishedBeaches();
      setBeaches(fresh);
      setIsCached(false);
      await writeBeachCache(fresh);
      setCachedAt(new Date().toISOString());
    } catch (cause: unknown) {
      const cache = await readBeachCache();
      if (cache) {
        setBeaches(cache.beaches);
        setIsCached(true);
        setCachedAt(cache.cachedAt);
      } else {
        setBeaches(initialBeaches);
        setIsCached(false);
      }
      setError(
        cause instanceof Error
          ? cause.message
          : "Beach data is unavailable. Showing the catalogue without live conditions.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return subscribeToConnectivity((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        setOffline(false);
        void syncPublishedBeaches()
          .then((fresh) => {
            setBeaches(fresh);
            setIsCached(false);
            setCachedAt(new Date().toISOString());
            setError(null);
          })
          .catch(() => {
            // Keep the last known good snapshot and let the existing banner remain.
          });
      } else if (state.isConnected === false) {
        setOffline(true);
        setIsCached(true);
      }
    });
  }, []);

  return { beaches, loading, error, isCached, cachedAt, refresh, offline };
}
