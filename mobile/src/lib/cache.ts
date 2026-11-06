import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Beach } from "../types/domain";

export const CACHE_KEY = "beach-mood:published-beaches:v2";
export const CACHE_SCHEMA_VERSION = 2;

export interface BeachCache {
  schemaVersion: number;
  cachedAt: string;
  beaches: Beach[];
}

export async function readBeachCache(): Promise<BeachCache | null> {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("schemaVersion" in parsed) ||
      !("cachedAt" in parsed) ||
      !("beaches" in parsed) ||
      parsed.schemaVersion !== CACHE_SCHEMA_VERSION ||
      typeof parsed.cachedAt !== "string" ||
      !Array.isArray(parsed.beaches)
    ) {
      return null;
    }
    return {
      schemaVersion: CACHE_SCHEMA_VERSION,
      cachedAt: parsed.cachedAt,
      beaches: parsed.beaches as Beach[],
    };
  } catch {
    return null;
  }
}

export async function writeBeachCache(beaches: Beach[]): Promise<void> {
  const value: BeachCache = {
    schemaVersion: CACHE_SCHEMA_VERSION,
    cachedAt: new Date().toISOString(),
    beaches,
  };
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(value));
}
