import AsyncStorage from "@react-native-async-storage/async-storage";

import { isBeachSnapshot } from "./validation";

import type { Beach } from "../types/domain";

export const CACHE_KEY = "beach-mood:published-beaches:v2";
export const CACHE_SCHEMA_VERSION = 2;

export interface BeachCache {
  schemaVersion: number;
  cachedAt: string;
  beaches: Beach[];
}

export async function readBeachCache(): Promise<BeachCache | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("schemaVersion" in parsed) ||
      !("cachedAt" in parsed) ||
      !("beaches" in parsed) ||
      parsed.schemaVersion !== CACHE_SCHEMA_VERSION ||
      typeof parsed.cachedAt !== "string" ||
      !isBeachSnapshot(parsed.beaches) ||
      !Number.isFinite(Date.parse(parsed.cachedAt))
    ) {
      return null;
    }
    return {
      schemaVersion: CACHE_SCHEMA_VERSION,
      cachedAt: parsed.cachedAt,
      beaches: parsed.beaches,
    };
  } catch {
    return null;
  }
}

export async function writeBeachCache(beaches: Beach[]): Promise<boolean> {
  if (!isBeachSnapshot(beaches)) return false;
  const value: BeachCache = {
    schemaVersion: CACHE_SCHEMA_VERSION,
    cachedAt: new Date().toISOString(),
    beaches,
  };
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
