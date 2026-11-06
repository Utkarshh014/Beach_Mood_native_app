import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";

export interface Database {
  public: {
    Tables: {
      beaches: {
        Row: {
          id: string;
          name: string;
          slug: string;
          state: string;
          district: string | null;
          location: unknown;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
      };
    };
    Views: {
      beach_public_status: {
        Row: {
          id: string;
          name: string;
          slug: string;
          state: string;
          district: string | null;
          latitude: number;
          longitude: number;
          is_published: boolean;
          valid_at: string | null;
          fetched_at: string | null;
          wave_height_m: number | null;
          wind_speed_ms: number | null;
          peak_period_s: number | null;
          current_speed_ms: number | null;
          water_quality: string | null;
          status: "Safe" | "Caution" | "Hazard" | null;
          risk_score: number | null;
          reason_codes: string[] | null;
          data_quality: "good" | "partial" | "stale" | "unknown" | null;
          scoring_version: string | null;
          active_alerts: unknown;
        };
      };
    };
    Functions: {
      get_nearby_beaches: {
        Args: { lat: number; lon: number; radius_meters: number };
        Returns: Array<{
          id: string;
          name: string;
          slug: string;
          state: string;
          district: string | null;
          latitude: number;
          longitude: number;
          distance_meters: number;
          status: "Safe" | "Caution" | "Hazard" | null;
          valid_at: string | null;
          fetched_at: string | null;
          wave_height_m: number | null;
          wind_speed_ms: number | null;
          peak_period_s: number | null;
          current_speed_ms: number | null;
          water_quality: string | null;
          risk_score: number | null;
          reason_codes: string[] | null;
          data_quality: "good" | "partial" | "stale" | "unknown" | null;
          active_alerts: unknown;
        }>;
      };
    };
  };
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY",
  );
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
