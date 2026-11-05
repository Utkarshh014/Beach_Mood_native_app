from __future__ import annotations

import struct
from typing import Any

from supabase import Client

from app.models import Beach, OceanAdvisory, ScoredObservation


class SupabaseRepository:
    def __init__(self, client: Client) -> None:
        self.client = client

    def list_beaches(self) -> list[Beach]:
        response = (
            self.client.table("beaches")
            .select("id,slug,name,location")
            .execute()
        )
        return [self._beach_from_row(row) for row in (response.data or [])]

    def upsert_result(
        self,
        beach: Beach,
        scored: ScoredObservation,
    ) -> None:
        observation = scored.observation
        condition = {
            "beach_id": beach.id,
            "source": observation.source,
            "source_record_id": self._record_id(observation),
            "valid_at": observation.valid_at.isoformat(),
            "fetched_at": observation.fetched_at.isoformat(),
            "wave_height_m": observation.wave_height_m,
            "wind_speed_ms": observation.wind_speed_ms,
            "peak_period_s": observation.peak_period_s,
            "current_speed_ms": observation.current_speed_ms,
            "water_quality": observation.water_quality,
            "status": scored.status,
            "risk_score": scored.risk_score,
            "reason_codes": scored.reason_codes,
            "data_quality": scored.data_quality,
            "scoring_version": scored.scoring_version,
            "raw_metadata": observation.raw_metadata,
        }
        existing = (
            self.client.table("beach_conditions")
            .select("id")
            .eq("beach_id", beach.id)
            .eq("source", observation.source)
            .eq("source_record_id", condition["source_record_id"])
            .limit(1)
            .execute()
        )
        if existing.data:
            (
                self.client.table("beach_conditions")
                .update(condition)
                .eq("id", existing.data[0]["id"])
                .execute()
            )
        else:
            self.client.table("beach_conditions").insert(condition).execute()

        for advisory in scored.advisories:
            self._upsert_advisory(beach, advisory)

        self.client.table("beaches").update(
            {"is_published": True, "updated_at": observation.fetched_at.isoformat()}
        ).eq("id", beach.id).execute()

    def list_active_advisories(self, beach: Beach) -> list[OceanAdvisory]:
        response = (
            self.client.table("ocean_alerts")
            .select(
                "source,source_alert_id,alert_type,severity,title,description,"
                "starts_at,ends_at,source_url"
            )
            .eq("beach_id", beach.id)
            .eq("is_active", True)
            .execute()
        )
        return [
            OceanAdvisory(
                source=str(row["source"]),
                source_alert_id=str(row["source_alert_id"]),
                beach_slug=beach.slug,
                alert_type=str(row["alert_type"]),
                severity=row["severity"],
                title=str(row["title"]),
                description=row.get("description"),
                starts_at=row["starts_at"],
                ends_at=row.get("ends_at"),
                source_url=row.get("source_url"),
            )
            for row in (response.data or [])
        ]

    def _upsert_advisory(self, beach: Beach, advisory: OceanAdvisory) -> None:
        row = {
            "beach_id": beach.id,
            "source": advisory.source,
            "source_alert_id": advisory.source_alert_id,
            "alert_type": advisory.alert_type,
            "severity": advisory.severity,
            "title": advisory.title,
            "description": advisory.description,
            "starts_at": advisory.starts_at.isoformat(),
            "ends_at": advisory.ends_at.isoformat() if advisory.ends_at else None,
            "is_active": True,
            "source_url": advisory.source_url,
        }
        self.client.table("ocean_alerts").upsert(
            row,
            on_conflict="source,source_alert_id,beach_id",
        ).execute()

    @staticmethod
    def _record_id(observation: Any) -> str:
        return f"{observation.source}:{observation.valid_at.isoformat()}"

    @classmethod
    def _beach_from_row(cls, row: dict[str, Any]) -> Beach:
        latitude, longitude = cls._coordinates(row.get("location"))
        return Beach(
            id=str(row["id"]),
            slug=str(row["slug"]),
            name=str(row["name"]),
            latitude=latitude,
            longitude=longitude,
        )

    @staticmethod
    def _coordinates(value: Any) -> tuple[float, float]:
        if isinstance(value, dict):
            coordinates = value.get("coordinates")
            if isinstance(coordinates, list) and len(coordinates) >= 2:
                return float(coordinates[1]), float(coordinates[0])
        if isinstance(value, str):
            text = value.strip()
            if text.upper().startswith("POINT"):
                pair = text[text.find("(") + 1 : text.rfind(")")].split()
                if len(pair) == 2:
                    return float(pair[1]), float(pair[0])
            if len(text) >= 42:
                try:
                    raw = bytes.fromhex(text)
                    little_endian = raw[0] == 1
                    byte_order = "<" if little_endian else ">"
                    geometry_type = struct.unpack_from(f"{byte_order}I", raw, 1)[0]
                    has_srid = bool(geometry_type & 0x20000000)
                    base_offset = 9 if has_srid else 5
                    is_point = geometry_type & 0xFF == 1
                    if is_point and len(raw) >= base_offset + 16:
                        longitude, latitude = struct.unpack_from(
                            f"{byte_order}dd", raw, base_offset
                        )
                        return latitude, longitude
                except (ValueError, struct.error):
                    pass
        raise ValueError("Unsupported beaches.location representation")
