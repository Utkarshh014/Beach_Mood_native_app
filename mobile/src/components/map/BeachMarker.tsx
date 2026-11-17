import React, { memo, useCallback } from "react";
import { Marker } from "react-native-maps";
import { Text, View } from "react-native";

import { displayStatus } from "../../services/suitability";

import type { Beach, SuitabilityStatus } from "../../types/domain";

const STATUS_COLORS: Record<SuitabilityStatus, string> = {
  Safe: "#22c55e",
  Caution: "#eab308",
  Hazard: "#ef4444",
};

interface BeachMarkerProps {
  beach: Beach;
  now: number;
  selected: boolean;
  onPress: (beach: Beach) => void;
}

function BeachMarkerComponent({
  beach,
  now,
  selected,
  onPress,
}: BeachMarkerProps) {
  const handlePress = useCallback(() => onPress(beach), [beach, onPress]);
  const status = displayStatus(beach, now);
  const color = status ? STATUS_COLORS[status] : "#64748b";

  return (
    <Marker
      identifier={beach.id}
      coordinate={{ latitude: beach.latitude, longitude: beach.longitude }}
      onPress={handlePress}
      tracksViewChanges={false}
      accessibilityLabel={`${beach.name}, ${status ?? "data unavailable"}`}
      accessibilityRole="button"
      accessibilityHint="Opens beach condition preview"
    >
      <View
        style={{
          width: selected ? 42 : 34,
          height: selected ? 42 : 34,
          borderRadius: selected ? 21 : 17,
          backgroundColor: color,
          borderColor: "#ffffff",
          borderWidth: selected ? 4 : 2,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#102A43",
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 12 }}>
          {status === "Safe"
            ? "S"
            : status === "Caution"
              ? "!"
              : status === "Hazard"
                ? "H"
                : "?"}
        </Text>
      </View>
    </Marker>
  );
}

export const BeachMarker = memo(BeachMarkerComponent);
