import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

import { readBeachCache, writeBeachCache } from "../lib/cache";
import { getPublishedBeaches } from "./beaches";
import { isBeachSnapshot } from "../lib/validation";
import type { Beach } from "../types/domain";

export const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

export function isStaleTimestamp(
  timestamp: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!timestamp) return true;
  const parsed = Date.parse(timestamp);
  return !Number.isFinite(parsed) || parsed > now || now - parsed > STALE_AFTER_MS;
}

export function isBeachStale(beach: Beach, now = Date.now()): boolean {
  return isStaleTimestamp(beach.validAt, now);
}

export function staleAdvisoryLabel(beach: Beach, now = Date.now()): string | null {
  return isBeachStale(beach, now)
    ? "Outdated Advisory - Proceed with Extreme Caution"
    : null;
}

export async function readOfflineSnapshot() {
  return readBeachCache();
}

export async function fetchBeachSnapshot(): Promise<{ beaches: Beach[]; cachedAt: string | null }> {
  const fresh = await getPublishedBeaches();
  if (!isBeachSnapshot(fresh)) {
    throw new Error("Empty beach response or malformed data was not cached.");
  }
  const saved = await writeBeachCache(fresh);
  return { beaches: fresh, cachedAt: saved ? new Date().toISOString() : null };
}

export async function syncPublishedBeaches(): Promise<Beach[]> {
  return (await fetchBeachSnapshot()).beaches;
}

export function subscribeToConnectivity(
  onChange: (state: NetInfoState) => void,
): () => void {
  return NetInfo.addEventListener(onChange);
}
