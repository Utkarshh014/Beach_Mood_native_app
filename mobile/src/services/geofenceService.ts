import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import type { Beach } from "../types/domain";

export const GEOFENCE_TASK_NAME = "beach-mood-hazard-geofence";
export const GEOFENCE_RADIUS_METERS = 2_500;
export const NOTIFICATION_COOLDOWN_MS = 6 * 60 * 60 * 1000;

const REGISTRY_KEY = "beach-mood:geofence-registry:v1";
const COOLDOWN_KEY = "beach-mood:geofence-cooldowns:v1";
const subscribers = new Set<(beach: Beach) => void>();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface Registry {
  beaches: Beach[];
}

interface Cooldowns {
  [beachId: string]: number;
}

export async function configureNotifications(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("hazards", {
      name: "Beach hazard alerts",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      vibrationPattern: [0, 250, 150, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export function subscribeToHazardEntries(
  callback: (beach: Beach) => void,
): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export async function registerHazardGeofences(
  beaches: Beach[],
): Promise<boolean> {
  const permission = await Location.getBackgroundPermissionsAsync();
  if (!permission.granted) return false;

  const monitored = beaches.filter(
    (beach) =>
      (beach.status === "Hazard" || beach.status === "Caution") &&
      Number.isFinite(beach.latitude) &&
      Number.isFinite(beach.longitude),
  );
  await AsyncStorage.setItem(
    REGISTRY_KEY,
    JSON.stringify({ beaches: monitored } satisfies Registry),
  );
  try {
    await Location.startGeofencingAsync(
      GEOFENCE_TASK_NAME,
      monitored.map((beach) => ({
        identifier: beach.id,
        latitude: beach.latitude,
        longitude: beach.longitude,
        radius: GEOFENCE_RADIUS_METERS,
        notifyOnEnter: true,
        notifyOnExit: false,
      })),
    );
    return true;
  } catch {
    return false;
  }
}

export async function stopHazardGeofences(): Promise<void> {
  try {
    if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME)) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
    }
  } catch {
    // Expo Go and simulators may not provide native geofence support.
  }
}

export function isHazardBeach(beach: Beach): boolean {
  return beach.status === "Hazard" || beach.activeAlerts.some((alert) =>
    ["high_swell", "rip_current", "storm_surge", "tsunami"].includes(
      alert.type.toLowerCase().replaceAll(" ", "_"),
    ),
  );
}

export async function processGeofenceEntry(
  beach: Beach,
  now = Date.now(),
): Promise<boolean> {
  if (!isHazardBeach(beach)) return false;
  const raw = await AsyncStorage.getItem(COOLDOWN_KEY);
  let cooldowns: Cooldowns = {};
  try {
    cooldowns = raw ? (JSON.parse(raw) as Cooldowns) : {};
  } catch {
    cooldowns = {};
  }
  const lastNotified = cooldowns[beach.id] ?? 0;
  if (now - lastNotified < NOTIFICATION_COOLDOWN_MS) return false;

  await configureNotifications();
  const permission = await requestNotificationPermission();
  if (!permission) return false;

  const alertTitle = beach.activeAlerts[0]?.title ?? "Hazard advisory";
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Hazard near ${beach.name}`,
      body: `${alertTitle}. Recreational swimming strictly prohibited.`,
      sound: "default",
      data: { beachId: beach.id, status: beach.status },
    },
    trigger: null,
  });
  cooldowns[beach.id] = now;
  await AsyncStorage.setItem(COOLDOWN_KEY, JSON.stringify(cooldowns));
  subscribers.forEach((callback) => callback(beach));
  return true;
}

export async function simulateGeofenceEntry(
  beach: Beach,
  now = Date.now(),
): Promise<boolean> {
  return processGeofenceEntry(beach, now);
}

export function evaluateGeofenceEntries(
  latitude: number,
  longitude: number,
  beaches: Beach[],
  radiusMeters = GEOFENCE_RADIUS_METERS,
): Beach[] {
  return beaches.filter(
    (beach) =>
      distanceMeters(latitude, longitude, beach.latitude, beach.longitude) <=
      radiusMeters,
  );
}

function distanceMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const earthRadius = 6_371_000;
  const radians = (value: number) => (value * Math.PI) / 180;
  const deltaLatitude = radians(latitudeB - latitudeA);
  const deltaLongitude = radians(longitudeB - longitudeA);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(radians(latitudeA)) *
      Math.cos(radians(latitudeB)) *
      Math.sin(deltaLongitude / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  if (error || !data || typeof data !== "object") return;
  const event = data as { eventType?: Location.GeofencingEventType; region?: { identifier?: string } };
  if (event.eventType !== Location.GeofencingEventType.Enter || !event.region?.identifier) {
    return;
  }
  const raw = await AsyncStorage.getItem(REGISTRY_KEY);
  if (!raw) return;
  let registry: Registry;
  try {
    registry = JSON.parse(raw) as Registry;
  } catch {
    return;
  }
  const beach = registry.beaches.find((item) => item.id === event.region?.identifier);
  if (beach) await processGeofenceEntry(beach);
});
