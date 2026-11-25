import type { ExpoConfig } from "expo/config";

const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();

if (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
) {
  throw new Error("Service-role credentials must not be present in the mobile build environment.");
}

if (
  process.env.EAS_BUILD_PLATFORM === "android" &&
  !androidGoogleMapsApiKey
) {
  throw new Error("GOOGLE_MAPS_ANDROID_API_KEY is required for Android builds.");
}

const config: ExpoConfig = {
  name: "Beach Mood",
  slug: "beach-mood",
  owner: "utkarsh_014",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.beachmood.app",
  },
  android: {
    package: "com.beachmood.app",
    adaptiveIcon: {
      backgroundColor: "#D9F0F2",
    },
  },
  plugins: [
    "expo-status-bar",
    [
      "expo-build-properties",
      {
        android: {
          // SDK 58 enables R8 for releases. WorkManager 2.9.1 (via maps)
          // creates its Room database and input mergers by reflection.
          // Preserve their constructors so startup succeeds in signed APKs.
          extraProguardRules: [
            "-keep class * extends androidx.room.RoomDatabase { <init>(); }",
            "-keep class * extends androidx.work.InputMerger { <init>(); }",
          ].join("\n"),
        },
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Beach Mood uses your location only when you request nearby beaches.",
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
      },
    ],
    [
      "expo-notifications",
      {
        color: "#EF4444",
      },
    ],
    "./plugins/withAndroidGoogleMaps",
  ],
  extra: {
    eas: {
      projectId: "3cdf0f34-cb01-4883-873e-92b29f15062a",
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  },
};

export default config;
