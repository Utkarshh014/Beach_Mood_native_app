import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

import { readBeachCache, writeBeachCache } from "../lib/cache";
import { getPublishedBeaches } from "./beaches";
import type { Beach } from "../types/domain";

export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export function isStaleTimestamp(
  timestamp: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!timestamp) return true;
  const parsed = Date.parse(timestamp);
  return !Number.isFinite(parsed) || now - parsed > STALE_AFTER_MS;
}

export function isBeachStale(beach: Beach, now = Date.now()): boolean {
  return isStaleTimestamp(beach.fetchedAt ?? beach.validAt, now);
}

export function staleAdvisoryLabel(beach: Beach, now = Date.now()): string | null {
  return isBeachStale(beach, now)
    ? "Outdated Advisory - Proceed with Extreme Caution"
    : null;
}

export async function readOfflineSnapshot() {
  return readBeachCache();
}

export async function syncPublishedBeaches(): Promise<Beach[]> {
  const fresh = await getPublishedBeaches();
  if (fresh.length === 0) {
    throw new Error("Empty beach response was not cached.");
  }
  await writeBeachCache(fresh);
  return fresh;
}

export function subscribeToConnectivity(
  onChange: (state: NetInfoState) => void,
): () => void {
  return NetInfo.addEventListener(onChange);
}
