import AsyncStorage from "@react-native-async-storage/async-storage";
import { CACHE_KEY, readBeachCache, writeBeachCache } from "../src/lib/cache";
import { fetchBeachSnapshot } from "../src/services/offlineSync";
import { getPublishedBeaches } from "../src/services/beaches";
import { beach } from "./fixtures";

jest.mock("../src/services/beaches", () => ({ getPublishedBeaches: jest.fn() }));
beforeEach(async () => { jest.restoreAllMocks(); await AsyncStorage.clear(); });

test("empty and malformed responses preserve the previous snapshot", async () => {
  await writeBeachCache([beach()]);
  const saved = await AsyncStorage.getItem(CACHE_KEY);
  for (const value of [[], [{ id: "broken" }], [beach({ latitude: 300 })]]) {
    (getPublishedBeaches as jest.Mock).mockResolvedValueOnce(value);
    await expect(fetchBeachSnapshot()).rejects.toThrow("not cached");
    expect(await AsyncStorage.getItem(CACHE_KEY)).toBe(saved);
  }
});

test("corrupt records in otherwise valid envelopes are rejected", async () => {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ schemaVersion: 2, cachedAt: new Date().toISOString(), beaches: [{ id: "broken" }] }));
  expect(await readBeachCache()).toBeNull();
});

test("storage read failures return no snapshot instead of throwing", async () => {
  jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("storage unavailable"));
  await expect(readBeachCache()).resolves.toBeNull();
});

test("storage write failure preserves fresh data in memory", async () => {
  const records = [beach()];
  (getPublishedBeaches as jest.Mock).mockResolvedValueOnce(records);
  jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("full"));
  await expect(fetchBeachSnapshot()).resolves.toEqual({ beaches: records, cachedAt: null });
});
