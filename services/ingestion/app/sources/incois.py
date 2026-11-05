from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

from app.models import Beach, OceanAdvisory, OceanObservation
from app.sources.base import SourceResult, parse_timestamp, request_json


class IncoisSource:
    """Adapter for a confirmed INCOIS JSON endpoint configured by the operator.

    INCOIS publishes multiple products with product-specific schemas. The
    endpoint and field mapping are therefore configuration-driven rather than
    fabricated here. The adapter accepts canonical names and common aliases
    documented in the Phase 2 source mapping.
    """

    name = "incois"

    def __init__(
        self,
        client: httpx.AsyncClient,
        url: str,
        token: str | None,
        retries: int = 3,
    ) -> None:
        self.client = client
        self.url = url
        self.token = token
        self.retries = retries

    async def fetch(self, beach: Beach) -> SourceResult:
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else None
        fetched_at = datetime.now(timezone.utc)
        payload = await request_json(
            self.client,
            self.url,
            params={"latitude": beach.latitude, "longitude": beach.longitude},
            headers=headers,
            retries=self.retries,
        )
        record = self._record(payload)
        observation = OceanObservation(
            beach_slug=beach.slug,
            source=self.name,
            valid_at=parse_timestamp(
                self._value(record, "valid_at", "validAt", "timestamp"),
                fetched_at,
            ),
            fetched_at=fetched_at,
            wave_height_m=self._number(
                record, "wave_height_m", "significant_wave_height", "hs"
            ),
            swell_height_m=self._number(
                record, "swell_height_m", "swell_wave_height"
            ),
            peak_period_s=self._number(
                record, "peak_period_s", "swell_period", "peak_period"
            ),
            wind_speed_ms=self._number(
                record, "wind_speed_ms", "wind_speed", "wind_speed_mps"
            ),
            current_speed_ms=self._number(
                record, "current_speed_ms", "ocean_current_velocity", "current_speed"
            ),
            raw_metadata={"provider": "INCOIS", "payload": payload},
        )
        return SourceResult(
            observation=observation,
            advisories=self._advisories(payload, beach.slug),
        )

    @staticmethod
    def _record(payload: Any) -> dict[str, Any]:
        if isinstance(payload, dict):
            record = payload.get("data", payload)
            if isinstance(record, list):
                record = record[0] if record else {}
            if isinstance(record, dict):
                return record
        raise ValueError("INCOIS response must contain an object or data record")

    @staticmethod
    def _value(record: dict[str, Any], *keys: str) -> Any:
        for key in keys:
            if key in record:
                return record[key]
        return None

    @classmethod
    def _number(cls, record: dict[str, Any], *keys: str) -> float | None:
        value = cls._value(record, *keys)
        return None if value is None else float(value)

    @classmethod
    def _advisories(cls, payload: Any, beach_slug: str) -> list[OceanAdvisory]:
        values = payload.get("alerts", payload.get("advisories", []))
        if not isinstance(values, list):
            return []
        advisories: list[OceanAdvisory] = []
        now = datetime.now(timezone.utc)
        for index, item in enumerate(values):
            if not isinstance(item, dict):
                continue
            advisories.append(
                OceanAdvisory(
                    source="incois",
                    source_alert_id=str(item.get("id", f"{beach_slug}-{index}")),
                    beach_slug=beach_slug,
                    alert_type=str(item.get("alert_type", item.get("type", "unknown"))),
                    severity=str(item.get("severity", "info")).lower(),
                    title=str(item.get("title", "INCOIS advisory")),
                    description=item.get("description"),
                    starts_at=parse_timestamp(item.get("starts_at"), now),
                    ends_at=(
                        parse_timestamp(item["ends_at"], now)
                        if item.get("ends_at")
                        else None
                    ),
                    source_url=item.get("source_url"),
                )
            )
        return advisories
