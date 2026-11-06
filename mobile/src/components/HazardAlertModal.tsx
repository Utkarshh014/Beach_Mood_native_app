import React from "react";
import { Modal, Pressable, Text, View } from "react-native";

import type { Beach } from "../types/domain";

interface HazardAlertModalProps {
  beach: Beach | null;
  onDismiss: () => void;
}

export function HazardAlertModal({ beach, onDismiss }: HazardAlertModalProps) {
  if (!beach) return null;
  const alert = beach.activeAlerts[0];
  const detail =
    alert?.title ??
    (beach.parameters.waveHeightM !== null
      ? `Wave height ${beach.parameters.waveHeightM.toFixed(1)} m`
      : "Hazardous coastal conditions detected");

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(16, 42, 67, 0.72)",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <View
          accessible
          accessibilityViewIsModal
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 22,
            padding: 22,
            borderTopWidth: 8,
            borderTopColor: "#ef4444",
          }}
        >
          <Text style={{ color: "#991B1B", fontSize: 13, fontWeight: "800" }}>
            HAZARD ADVISORY
          </Text>
          <Text style={{ color: "#172B4D", fontSize: 24, fontWeight: "800", marginTop: 8 }}>
            Near {beach.name}
          </Text>
          <Text style={{ color: "#627D98", fontSize: 16, marginTop: 12 }}>
            {detail}
          </Text>
          <Text style={{ color: "#991B1B", fontSize: 17, fontWeight: "800", marginTop: 18 }}>
            Recreational swimming strictly prohibited.
          </Text>
          <Text style={{ color: "#627D98", marginTop: 10 }}>
            Follow local authorities and lifeguard instructions. This advisory is
            based on available data and may change quickly.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss hazard alert"
            accessibilityHint="Closes the emergency warning"
            onPress={onDismiss}
            style={{
              backgroundColor: "#991B1B",
              borderRadius: 12,
              marginTop: 20,
              paddingVertical: 13,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#ffffff", fontWeight: "800" }}>Dismiss</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
