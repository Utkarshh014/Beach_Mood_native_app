import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import {
  GEOFENCE_RADIUS_METERS,
  NOTIFICATION_COOLDOWN_MS,
  evaluateGeofenceEntries,
  processGeofenceEntry,
} from "../src/services/geofenceService";
import { beach } from "./fixtures";

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
    granted: true,
  });
  (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
    granted: true,
  });
});

test("finds beaches inside the configured geofence radius", () => {
  const record = beach();
  expect(
    evaluateGeofenceEntries(record.latitude, record.longitude, [record]),
  ).toEqual([record]);
  expect(
    evaluateGeofenceEntries(record.latitude + 1, record.longitude, [record]),
  ).toEqual([]);
  expect(GEOFENCE_RADIUS_METERS).toBe(2500);
});

test("schedules a hazard notification once and suppresses cooldown repeats", async () => {
  const record = beach({
    status: "Hazard",
    activeAlerts: [
      {
        id: "alert-1",
        type: "storm_surge",
        severity: "warning",
        title: "Storm surge warning",
        description: null,
        startsAt: new Date().toISOString(),
        endsAt: null,
        source: "test",
        sourceUrl: null,
      },
    ],
  });

  const firstEntry = NOTIFICATION_COOLDOWN_MS + 1_000;
  await expect(processGeofenceEntry(record, firstEntry)).resolves.toBe(true);
  await expect(
    processGeofenceEntry(record, firstEntry + NOTIFICATION_COOLDOWN_MS - 1),
  ).resolves.toBe(false);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
});

test("does not notify for a safe beach", async () => {
  await expect(processGeofenceEntry(beach(), Date.now())).resolves.toBe(false);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});
