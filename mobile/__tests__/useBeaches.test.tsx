import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useBeaches } from "../src/hooks/useBeaches";
import { writeBeachCache } from "../src/lib/cache";
import { fetchBeachSnapshot } from "../src/services/offlineSync";
import { beach } from "./fixtures";

jest.mock("../src/services/offlineSync", () => ({
  fetchBeachSnapshot: jest.fn(),
  subscribeToConnectivity: jest.fn(() => jest.fn()),
}));
beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); });

test("cold start shows cached data while the network request remains pending", async () => {
  await writeBeachCache([beach({ name: "Cached beach" })]);
  (fetchBeachSnapshot as jest.Mock).mockReturnValue(new Promise(() => {}));
  const { result } = renderHook(useBeaches);
  await waitFor(() => expect(result.current.beaches[0].name).toBe("Cached beach"));
  expect(result.current.isCached).toBe(true);
  expect(result.current.loading).toBe(false);
});

test("overlapping refresh requests share one network operation", async () => {
  let resolve!: (value: unknown) => void;
  (fetchBeachSnapshot as jest.Mock).mockReturnValue(new Promise((done) => { resolve = done; }));
  const { result } = renderHook(useBeaches);
  await waitFor(() => expect(fetchBeachSnapshot).toHaveBeenCalledTimes(1));
  let first!: Promise<void>, second!: Promise<void>;
  act(() => { first = result.current.refresh(); second = result.current.refresh(); });
  expect(first).toBe(second);
  expect(fetchBeachSnapshot).toHaveBeenCalledTimes(1);
  await act(async () => { resolve({ beaches: [beach()], cachedAt: new Date().toISOString() }); await first; });
  expect(result.current.loading).toBe(false);
});

test("failed refresh retains newer in-memory data", async () => {
  (fetchBeachSnapshot as jest.Mock).mockResolvedValueOnce({ beaches: [beach({ name: "New beach data" })], cachedAt: null });
  const { result } = renderHook(useBeaches);
  await waitFor(() => expect(result.current.beaches[0].name).toBe("New beach data"));
  await writeBeachCache([beach({ name: "Older cached data" })]);
  (fetchBeachSnapshot as jest.Mock).mockRejectedValueOnce(new Error("offline"));
  await act(async () => { await result.current.refresh(); });
  expect(result.current.beaches[0].name).toBe("New beach data");
  expect(result.current.loading).toBe(false);
});
