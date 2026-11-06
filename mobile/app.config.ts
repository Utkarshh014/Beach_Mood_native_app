import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Beach Mood",
  slug: "beach-mood",
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
    "react-native-maps",
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  },
};

export default config;
