import React from "react";
import { Text, View } from "react-native";

interface OfflineBannerProps {
  message: string;
  cachedAt: string | null;
}

export function OfflineBanner({ message, cachedAt }: OfflineBannerProps) {
  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityHint="Beach data may be stale while offline"
      style={{
        position: "absolute",
        top: 54,
        left: 16,
        right: 16,
        backgroundColor: "#FFF7ED",
        borderColor: "#FB923C",
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
      }}
    >
      <Text style={{ color: "#9A3412", fontWeight: "700" }}>{message}</Text>
      {cachedAt ? (
        <Text style={{ color: "#9A3412", fontSize: 12, marginTop: 3 }}>
          Cached at {new Date(cachedAt).toLocaleString()}
        </Text>
      ) : null}
    </View>
  );
}
