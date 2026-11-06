import React from "react";
import { Text, View } from "react-native";

import type { SuitabilityStatus } from "../../types/domain";

interface StatusBadgeProps {
  status: SuitabilityStatus | null;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const color =
    status === "Safe"
      ? "#22c55e"
      : status === "Caution"
        ? "#eab308"
        : status === "Hazard"
          ? "#ef4444"
          : "#64748b";
  const label = status ?? "Data unavailable";

  return (
    <View
      accessible
      accessibilityLabel={`Suitability: ${label}`}
      style={{
        alignSelf: "flex-start",
        borderRadius: 999,
        backgroundColor: `${color}22`,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: color,
      }}
    >
      <Text style={{ color, fontSize: 12, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}
