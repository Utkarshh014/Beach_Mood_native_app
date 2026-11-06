import React, { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import type { Beach } from "../../types/domain";
import { StatusBadge } from "./StatusBadge";
import { staleAdvisoryLabel } from "../../services/offlineSync";

interface BeachCardProps {
  beach: Beach | null;
  onClose: () => void;
  onViewDetails: (beach: Beach) => void;
}

function formatMetric(value: number | null, unit: string): string {
  return value === null ? "Not available" : `${value.toFixed(1)} ${unit}`;
}

function summaryFor(beach: Beach): string {
  if (beach.activeAlerts.length > 0) {
    return beach.activeAlerts[0].title;
  }
  if (beach.status === "Safe") return "No elevated hazard detected";
  if (beach.status === "Caution") return "Use caution with current conditions";
  if (beach.status === "Hazard") return "Hazard advisory";
  return "Live condition data unavailable";
}

export function BeachCard({ beach, onClose, onViewDetails }: BeachCardProps) {
  const translateY = useSharedValue(360);

  useEffect(() => {
    translateY.value = withSpring(beach ? 0 : 360, {
      damping: 18,
      stiffness: 150,
    });
  }, [beach, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      pointerEvents={beach ? "auto" : "none"}
      style={[
        {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 24,
          borderRadius: 20,
          backgroundColor: "#ffffff",
          padding: 18,
          shadowColor: "#102A43",
          shadowOpacity: 0.18,
          shadowRadius: 12,
          elevation: 8,
        },
        animatedStyle,
      ]}
    >
      {beach ? (
        <>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: "#172B4D", fontSize: 20, fontWeight: "800" }}>
                {beach.name}
              </Text>
              <Text style={{ color: "#627D98", marginTop: 3 }}>
                {[beach.district, beach.state].filter(Boolean).join(", ")}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close beach preview"
              accessibilityHint="Closes the beach condition preview"
              hitSlop={10}
              onPress={onClose}
            >
              <Text style={{ color: "#627D98", fontSize: 22 }}>×</Text>
            </Pressable>
          </View>
          <View style={{ marginTop: 12 }}>
            <StatusBadge status={beach.status} />
            <Text style={{ color: "#627D98", marginTop: 8 }}>{summaryFor(beach)}</Text>
            {staleAdvisoryLabel(beach) ? (
              <Text style={{ color: "#9A3412", fontWeight: "700", marginTop: 6 }}>
                Outdated advisory — proceed with extreme caution
              </Text>
            ) : null}
            {beach.distanceMeters !== undefined ? (
              <Text style={{ color: "#627D98", marginTop: 5, fontWeight: "700" }}>
                {formatDistance(beach.distanceMeters)} away
              </Text>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", marginTop: 16 }}>
            <Metric label="Wave" value={formatMetric(beach.parameters.waveHeightM, "m")} />
            <Metric
              label="Wind"
              value={formatMetric(beach.parameters.windSpeedMs, "m/s")}
            />
            <Metric
              label="Current"
              value={formatMetric(beach.parameters.currentSpeedMs, "m/s")}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View details for ${beach.name}`}
            accessibilityHint="Opens detailed ocean conditions and safety guidance"
            onPress={() => onViewDetails(beach)}
            style={{
              backgroundColor: "#0B6E8A",
              borderRadius: 12,
              marginTop: 16,
              paddingVertical: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#ffffff", fontWeight: "800" }}>View Details</Text>
          </Pressable>
        </>
      ) : null}
    </Animated.View>
  );
}

function formatDistance(distanceMeters: number): string {
  return distanceMeters < 1000
    ? `${Math.round(distanceMeters)} m`
    : `${(distanceMeters / 1000).toFixed(1)} km`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: "#627D98", fontSize: 12 }}>{label}</Text>
      <Text style={{ color: "#172B4D", fontSize: 13, fontWeight: "700", marginTop: 3 }}>
        {value}
      </Text>
    </View>
  );
}
