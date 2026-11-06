import React from "react";
import { Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";

import { staleAdvisoryLabel } from "../services/offlineSync";
import type { Beach } from "../types/domain";
import { StatusBadge } from "../components/beach/StatusBadge";

interface BeachDetailModalProps {
  beach: Beach | null;
  onClose: () => void;
}

export function BeachDetailModal({ beach, onClose }: BeachDetailModalProps) {
  if (!beach) return null;
  const staleLabel = staleAdvisoryLabel(beach);
  const activityGuidance =
    beach.status === "Safe"
      ? "Safe for Swimming, Water Sports, and Shoreline Recreation"
      : beach.status === "Caution"
        ? "Shoreline Access Only; Swimming Discouraged; Watch for Rip Currents"
        : beach.status === "Hazard"
          ? "Water Access Prohibited; Active Hazard / Surge Alert"
          : "Data unavailable. Do not treat this beach as verified safe.";

  const openDirections = async () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${beach.latitude},${beach.longitude}`;
    try {
      await Linking.openURL(url);
    } catch {
      // The device may not have a supported navigation handler.
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ScrollView
        accessibilityLabel={`${beach.name} beach details`}
        contentContainerStyle={{ padding: 20, paddingTop: 58, backgroundColor: "#F7FAFC", flexGrow: 1 }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: "#172B4D", fontSize: 28, fontWeight: "800" }}>{beach.name}</Text>
            <Text style={{ color: "#627D98", marginTop: 5 }}>
              {[beach.district, beach.state].filter(Boolean).join(", ")}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close beach details"
            accessibilityHint="Returns to the beach map"
            hitSlop={10}
            style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
            onPress={onClose}
          >
            <Text style={{ color: "#172B4D", fontSize: 28 }}>×</Text>
          </Pressable>
        </View>

        <View style={{ marginTop: 20 }}>
          <StatusBadge status={beach.status} />
          <Text style={{ color: "#172B4D", fontWeight: "700", marginTop: 10 }}>{activityGuidance}</Text>
        </View>

        {staleLabel ? (
          <View style={{ backgroundColor: "#FFF7ED", borderColor: "#FB923C", borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 16 }}>
            <Text style={{ color: "#9A3412", fontWeight: "800" }}>{staleLabel}</Text>
          </View>
        ) : null}

        <Text style={sectionTitle}>Oceanographic breakdown</Text>
        <Metric label="Significant wave height (Hs)" value={formatMetric(beach.parameters.waveHeightM, "m")} />
        <Metric label="Wave period (Tp)" value={formatMetric(beach.parameters.peakPeriodS, "s")} />
        <Metric label="Wind speed" value={formatMetric(beach.parameters.windSpeedMs, "m/s")} />
        <Metric label="Wind direction" value={formatDirection(beach.parameters.windDirectionDeg)} />
        <Metric label="Surface current velocity" value={formatMetric(beach.parameters.currentSpeedMs, "m/s")} />

        <Text style={sectionTitle}>Active alerts and warnings</Text>
        {beach.activeAlerts.length > 0 ? beach.activeAlerts.map((alert) => (
          <View key={alert.id} style={{ borderLeftWidth: 4, borderLeftColor: "#ef4444", paddingLeft: 12, marginBottom: 12 }}>
            <Text style={{ color: "#991B1B", fontWeight: "800" }}>{alert.title}</Text>
            <Text style={{ color: "#627D98", marginTop: 3 }}>{alert.type} · {alert.source}</Text>
            {alert.description ? <Text style={{ color: "#627D98", marginTop: 3 }}>{alert.description}</Text> : null}
          </View>
        )) : <Text style={{ color: "#627D98" }}>No active official alert is recorded.</Text>}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open directions to ${beach.name}`}
          accessibilityHint="Opens the device's default maps application"
          onPress={() => void openDirections()}
          style={{ minHeight: 48, backgroundColor: "#0B6E8A", borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 20 }}
        >
          <Text style={{ color: "#ffffff", fontWeight: "800" }}>Open Directions</Text>
        </Pressable>
      </ScrollView>
    </Modal>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#D9E2EC" }}>
      <Text style={{ color: "#627D98", fontSize: 12 }}>{label}</Text>
      <Text style={{ color: "#172B4D", fontSize: 16, fontWeight: "700", marginTop: 3 }}>{value}</Text>
    </View>
  );
}

function formatMetric(value: number | null, unit: string): string {
  return value === null ? "Not available" : `${value.toFixed(1)} ${unit}`;
}

function formatDirection(value: number | null | undefined): string {
  return typeof value === "number" ? `${Math.round(value)}°` : "Not available";
}

const sectionTitle = {
  color: "#172B4D",
  fontSize: 18,
  fontWeight: "800" as const,
  marginTop: 24,
  marginBottom: 6,
};
