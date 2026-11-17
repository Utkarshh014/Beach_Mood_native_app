import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { initialBeaches } from "../data/initialBeaches";
import { readBeachCache } from "../lib/cache";
import { fetchBeachSnapshot, subscribeToConnectivity } from "../services/offlineSync";
import type { Beach } from "../types/domain";

export function useBeaches() {
  const [beaches, setBeaches] = useState<Beach[]>(initialBeaches);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const pending = useRef<Promise<void> | null>(null);
  const hasSnapshot = useRef(false);
  const mounted = useRef(true);

  const refresh = useCallback((): Promise<void> => {
    if (pending.current) return pending.current;
    const operation = (async () => {
      if (!mounted.current) return;
      setLoading(!hasSnapshot.current);
      try {
        const snapshot = await fetchBeachSnapshot();
        if (!mounted.current) return;
        hasSnapshot.current = true;
        setBeaches(snapshot.beaches);
        setIsCached(false);
        setCachedAt(snapshot.cachedAt);
        setError(snapshot.cachedAt ? null : "Current data loaded, but offline storage is unavailable.");
      } catch (cause: unknown) {
        if (!mounted.current) return;
        // A failed refresh never replaces newer in-memory data with older cache.
        if (!hasSnapshot.current) {
          const cache = await readBeachCache();
          if (!mounted.current) return;
          if (cache) {
            hasSnapshot.current = true;
            setBeaches(cache.beaches);
            setIsCached(true);
            setCachedAt(cache.cachedAt);
          }
        }
        setError(cause instanceof Error ? cause.message : "Beach data unavailable.");
      } finally {
        if (mounted.current) setLoading(false);
      }
    })();
    pending.current = operation;
    void operation.finally(() => { pending.current = null; });
    return operation;
  }, []);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    // Load the last good snapshot before waiting for a network timeout.
    void readBeachCache().then((cache) => {
      if (cancelled) return;
      if (cache && !hasSnapshot.current) {
        hasSnapshot.current = true;
        setBeaches(cache.beaches);
        setIsCached(true);
        setCachedAt(cache.cachedAt);
        setLoading(false);
      }
      void refresh();
    });
    const removeConnectivity = subscribeToConnectivity((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        setOffline(false);
        void refresh();
      } else if (state.isConnected === false || state.isInternetReachable === false) {
        setOffline(true);
      }
    });
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => {
      cancelled = true;
      mounted.current = false;
      removeConnectivity();
      subscription.remove();
    };
  }, [refresh]);

  return { beaches, loading, error, isCached, cachedAt, refresh, offline };
}
