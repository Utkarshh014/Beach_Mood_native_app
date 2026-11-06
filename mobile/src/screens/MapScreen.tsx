import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import MapView, { Region } from "react-native-maps";
import { StatusBar } from "expo-status-bar";

import { HazardAlertModal } from "../components/HazardAlertModal";
import { BeachCard } from "../components/beach/BeachCard";
import { OfflineBanner } from "../components/common/OfflineBanner";
import { BeachMarker } from "../components/map/BeachMarker";
import { useNearbyBeaches } from "../hooks/useNearbyBeaches";
import { useBeaches } from "../hooks/useBeaches";
import { useUserLocation } from "../hooks/useUserLocation";
import {
  configureNotifications,
  registerHazardGeofences,
  requestNotificationPermission,
  simulateGeofenceEntry,
  subscribeToHazardEntries,
} from "../services/geofenceService";
import type { Beach } from "../types/domain";
import { BeachDetailModal } from "./BeachDetailModal";

const INITIAL_REGION: Region = {
  latitude: 15,
  longitude: 78,
  latitudeDelta: 22,
  longitudeDelta: 22,
};

export function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const { beaches, loading, error, isCached, cachedAt, refresh, offline } = useBeaches();
  const location = useUserLocation();
  const nearby = useNearbyBeaches(location.location);
  const [selectedBeach, setSelectedBeach] = useState<Beach | null>(null);
  const [showNearby, setShowNearby] = useState(false);
  const [hazardBeach, setHazardBeach] = useState<Beach | null>(null);
  const [detailBeach, setDetailBeach] = useState<Beach | null>(null);

  const sourceBeaches = showNearby && location.location ? nearby.beaches : beaches;
  const visibleBeaches = useMemo(
    () =>
      sourceBeaches.filter(
        (beach) =>
          Number.isFinite(beach.latitude) && Number.isFinite(beach.longitude),
      ),
    [sourceBeaches],
  );
  const handleMarkerPress = useCallback((beach: Beach) => {
    setSelectedBeach(beach);
  }, []);
  const handleCloseCard = useCallback(() => setSelectedBeach(null), []);
  const handleViewDetails = useCallback((beach: Beach) => {
    setDetailBeach(beach);
  }, []);

  const locateMe = useCallback(async () => {
    const current = await location.requestForegroundLocation();
    if (current) {
      mapRef.current?.animateToRegion(
        {
          latitude: current.latitude,
          longitude: current.longitude,
          latitudeDelta: 0.35,
          longitudeDelta: 0.35,
        },
        700,
      );
    }
  }, [location]);

  const enableHazardAlerts = useCallback(async () => {
    const granted = await location.requestBackgroundPermission();
    if (!granted) return;
    await configureNotifications();
    if (!(await requestNotificationPermission())) return;
    await registerHazardGeofences(beaches);
  }, [beaches, location]);

  const simulateHazardAlert = useCallback(async () => {
    const target = beaches.find((beach) => beach.status === "Hazard");
    if (!target) return;
    await simulateGeofenceEntry(target);
    setHazardBeach(target);
  }, [beaches]);

  useEffect(() => {
    const unsubscribe = subscribeToHazardEntries(setHazardBeach);
    return unsubscribe;
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#F7FAFC" }}>
      <StatusBar style="dark" />
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={INITIAL_REGION}
        showsUserLocation={false}
        showsCompass
        loadingEnabled
        accessibilityLabel="Beach Mood map of Indian beaches"
      >
        {visibleBeaches.map((beach) => (
          <BeachMarker
            key={`${beach.id}-${beach.status ?? "unknown"}`}
            beach={beach}
            selected={selectedBeach?.id === beach.id}
            onPress={handleMarkerPress}
          />
        ))}
      </MapView>

      <View
        style={{
          position: "absolute",
          top: 138,
          right: 16,
          gap: 8,
          alignItems: "flex-end",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Locate me"
          onPress={() => void locateMe()}
          accessibilityHint="Requests location permission and centers the map on your position"
          style={controlStyle}
        >
          <Text style={controlTextStyle}>Locate Me</Text>
        </Pressable>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: showNearby }}
          onPress={() => setShowNearby((current) => !current)}
          accessibilityHint="Switches between the national beach catalogue and beaches within 50 kilometres"
          style={[controlStyle, showNearby ? { backgroundColor: "#0B6E8A" } : null]}
        >
          <Text style={[controlTextStyle, showNearby ? { color: "#ffffff" } : null]}>
            {showNearby ? "Nearby < 50 km" : "All Beaches"}
          </Text>
        </Pressable>
        {location.foregroundPermission === "granted" &&
        location.backgroundPermission !== "granted" ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void enableHazardAlerts()}
            style={controlStyle}
          >
            <Text style={controlTextStyle}>Enable Hazard Alerts</Text>
          </Pressable>
        ) : null}
        {process.env.EXPO_PUBLIC_E2E === "true" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Simulate Hazard Alert"
            accessibilityHint="Opens a deterministic hazard warning for end-to-end testing"
            onPress={() => void simulateHazardAlert()}
            style={controlStyle}
          >
            <Text style={controlTextStyle}>Simulate Hazard Alert</Text>
          </Pressable>
        ) : null}
      </View>

      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          paddingTop: 48,
          paddingHorizontal: 16,
        }}
      >
        <View
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 16,
            padding: 14,
            shadowColor: "#102A43",
            shadowOpacity: 0.14,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Text style={{ color: "#102A43", fontSize: 24, fontWeight: "800" }}>
            Beach Mood
          </Text>
          <Text style={{ color: "#627D98", marginTop: 2 }}>
            Coastal conditions across India
          </Text>
        </View>
      </View>

      {loading ? (
        <View
          style={{
            position: "absolute",
            top: 142,
            alignSelf: "center",
            backgroundColor: "#ffffff",
            borderRadius: 999,
            padding: 10,
          }}
        >
          <ActivityIndicator color="#0B6E8A" />
        </View>
      ) : null}

      {error || offline ? (
        <OfflineBanner
          message={offline || isCached ? "Offline Mode: Showing cached beach data." : error ?? "Beach data unavailable."}
          cachedAt={cachedAt}
        />
      ) : null}

      {showNearby && nearby.loading ? (
        <View style={nearbyLoadingStyle}>
          <ActivityIndicator color="#0B6E8A" size="small" />
          <Text style={{ color: "#627D98", marginLeft: 7 }}>Finding nearby beaches…</Text>
        </View>
      ) : null}

      {showNearby && nearby.error ? (
        <OfflineBanner message={nearby.error} cachedAt={null} />
      ) : null}

      {!loading && !error && visibleBeaches.length === 0 ? (
        <View
          style={{
            position: "absolute",
            top: 160,
            alignSelf: "center",
            backgroundColor: "#ffffff",
            padding: 14,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: "#627D98", textAlign: "center" }}>
            No coastal beaches found within 50 km of your current location.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View all coastal beaches"
            accessibilityHint="Returns to the national beach catalogue"
            onPress={() => setShowNearby(false)}
            style={{ minHeight: 44, justifyContent: "center", alignItems: "center", marginTop: 6 }}
          >
            <Text style={{ color: "#0B6E8A", fontWeight: "800" }}>
              Tap to view all coastal beaches in India
            </Text>
          </Pressable>
        </View>
      ) : null}

      {error && !isCached ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void refresh()}
          style={{
            position: "absolute",
            top: 142,
            right: 16,
            backgroundColor: "#0B6E8A",
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 9,
          }}
        >
          <Text style={{ color: "#ffffff", fontWeight: "700" }}>Retry</Text>
        </Pressable>
      ) : null}

      <BeachCard
        beach={selectedBeach}
        onClose={handleCloseCard}
        onViewDetails={handleViewDetails}
      />
      <BeachDetailModal beach={detailBeach} onClose={() => setDetailBeach(null)} />
      <HazardAlertModal
        beach={hazardBeach}
        onDismiss={() => setHazardBeach(null)}
      />
    </View>
  );
}

const controlStyle = {
  backgroundColor: "#ffffff",
  borderRadius: 12,
  minHeight: 44,
  justifyContent: "center" as const,
  paddingHorizontal: 12,
  paddingVertical: 10,
  shadowColor: "#102A43",
  shadowOpacity: 0.16,
  shadowRadius: 5,
  elevation: 3,
} as const;

const controlTextStyle = {
  color: "#0B6E8A",
  fontWeight: "800",
} as const;

const nearbyLoadingStyle = {
  position: "absolute" as const,
  top: 215,
  alignSelf: "center" as const,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  backgroundColor: "#ffffff",
  borderRadius: 999,
  paddingHorizontal: 12,
  paddingVertical: 9,
};
