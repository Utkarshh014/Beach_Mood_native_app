import React, { memo, useCallback } from "react";
import { Marker } from "react-native-maps";
import { Text, View } from "react-native";

import type { Beach, SuitabilityStatus } from "../../types/domain";

const STATUS_COLORS: Record<SuitabilityStatus, string> = {
  Safe: "#22c55e",
  Caution: "#eab308",
  Hazard: "#ef4444",
};

interface BeachMarkerProps {
  beach: Beach;
  selected: boolean;
  onPress: (beach: Beach) => void;
}

function BeachMarkerComponent({
  beach,
  selected,
  onPress,
}: BeachMarkerProps) {
  const handlePress = useCallback(() => onPress(beach), [beach, onPress]);
  const color = beach.status ? STATUS_COLORS[beach.status] : "#64748b";

  return (
    <Marker
      identifier={beach.id}
      coordinate={{ latitude: beach.latitude, longitude: beach.longitude }}
      onPress={handlePress}
      tracksViewChanges={false}
      accessibilityLabel={`${beach.name}, ${beach.status ?? "data unavailable"}`}
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
          {beach.status === "Safe"
            ? "S"
            : beach.status === "Caution"
              ? "!"
              : beach.status === "Hazard"
                ? "H"
                : "?"}
        </Text>
      </View>
    </Marker>
  );
}

export const BeachMarker = memo(BeachMarkerComponent);
