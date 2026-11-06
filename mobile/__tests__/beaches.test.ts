jest.mock("../src/lib/supabase", () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

import { getNearbyBeaches, getPublishedBeaches } from "../src/services/beaches";

const mockSupabase = jest.requireMock("../src/lib/supabase").supabase as {
  from: jest.Mock;
  rpc: jest.Mock;
};
const mockFrom = mockSupabase.from;
const mockRpc = mockSupabase.rpc;

const row = {
  id: "1",
  name: "Marina Beach",
  slug: "marina-beach",
  state: "Tamil Nadu",
  district: "Chennai",
  latitude: 13.05,
  longitude: 80.28,
  distance_meters: 1200,
  status: "Safe",
  valid_at: null,
  fetched_at: null,
  wave_height_m: 0.5,
  wind_speed_ms: 4,
  peak_period_s: 8,
  current_speed_ms: 0.2,
  water_quality: null,
  risk_score: 0,
  reason_codes: [],
  data_quality: "good",
  active_alerts: [],
};

beforeEach(() => {
  jest.clearAllMocks();
});

test("queries published beach status and maps rows", async () => {
  const select = jest.fn().mockResolvedValue({ data: [row], error: null });
  mockFrom.mockReturnValue({ select });

  await expect(getPublishedBeaches()).resolves.toEqual([
    expect.objectContaining({ name: "Marina Beach", status: "Safe" }),
  ]);
  expect(mockFrom).toHaveBeenCalledWith("beach_public_status");
  expect(select).toHaveBeenCalledWith("*");
});

test("invokes nearby PostGIS RPC with the requested radius", async () => {
  mockRpc.mockResolvedValue({ data: [row], error: null });

  const beaches = await getNearbyBeaches(13.05, 80.28, 50_000);

  expect(mockRpc).toHaveBeenCalledWith("get_nearby_beaches", {
    lat: 13.05,
    lon: 80.28,
    radius_meters: 50_000,
  });
  expect(beaches[0].distanceMeters).toBe(1200);
});

test("returns an empty list for an empty successful response", async () => {
  const select = jest.fn().mockResolvedValue({ data: null, error: null });
  mockFrom.mockReturnValue({ select });

  await expect(getPublishedBeaches()).resolves.toEqual([]);
});

test("surfaces Supabase errors", async () => {
  const select = jest.fn().mockResolvedValue({
    data: null,
    error: { message: "network unavailable" },
  });
  mockFrom.mockReturnValue({ select });

  await expect(getPublishedBeaches()).rejects.toThrow("network unavailable");
});
