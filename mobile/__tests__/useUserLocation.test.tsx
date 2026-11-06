import { act, renderHook } from "@testing-library/react-native";
import * as Location from "expo-location";

import { useUserLocation } from "../src/hooks/useUserLocation";

beforeEach(() => {
  jest.clearAllMocks();
});

test("returns GPS coordinates when foreground permission is granted", async () => {
  (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
    granted: true,
  });
  (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
    timestamp: Date.parse("2026-11-05T12:00:00.000Z"),
    coords: { latitude: 13.05, longitude: 80.28, accuracy: 10 },
  });
  const hook = renderHook(() => useUserLocation());

  await act(async () => {
    await hook.result.current.requestForegroundLocation();
  });

  expect(hook.result.current.foregroundPermission).toBe("granted");
  expect(hook.result.current.location).toEqual(
    expect.objectContaining({ latitude: 13.05, longitude: 80.28 }),
  );
  expect(hook.result.current.tracking).toBe(true);
});

test("falls back without crashing when permission is denied", async () => {
  (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
    granted: false,
  });
  const hook = renderHook(() => useUserLocation());

  await act(async () => {
    await hook.result.current.requestForegroundLocation();
  });

  expect(hook.result.current.foregroundPermission).toBe("denied");
  expect(hook.result.current.location).toBeNull();
  expect(hook.result.current.error).toContain("national map");
});
