from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

from app.models import Beach, OceanObservation
from app.sources.base import SourceResult, parse_timestamp, request_json


class OpenMeteoMarineSource:
    name = "open-meteo-marine"

    def __init__(
        self,
        client: httpx.AsyncClient,
        base_url: str,
        retries: int = 3,
    ) -> None:
        self.client = client
        self.base_url = base_url
        self.retries = retries

    async def fetch(self, beach: Beach) -> SourceResult:
        fetched_at = datetime.now(timezone.utc)
        payload = await request_json(
            self.client,
            self.base_url,
            params={
                "latitude": beach.latitude,
                "longitude": beach.longitude,
                "hourly": ",".join(
                    (
                        "wave_height",
                        "swell_wave_height",
                        "swell_wave_period",
                        "wind_speed_10m",
                        "ocean_current_velocity",
                    )
                ),
                "forecast_days": 1,
                "timezone": "UTC",
            },
            retries=self.retries,
        )
        hourly = payload.get("hourly")
        if not isinstance(hourly, dict):
            raise ValueError("Open-Meteo response has no hourly data")

        def first_number(key: str) -> float | None:
            values = hourly.get(key)
            if not isinstance(values, list) or not values:
                return None
            value = values[0]
            return float(value) if value is not None else None

        times = hourly.get("time")
        valid_at = parse_timestamp(
            times[0] if isinstance(times, list) and times else None,
            fetched_at,
        )
        observation = OceanObservation(
            beach_slug=beach.slug,
            source=self.name,
            valid_at=valid_at,
            fetched_at=fetched_at,
            wave_height_m=first_number("wave_height"),
            swell_height_m=first_number("swell_wave_height"),
            peak_period_s=first_number("swell_wave_period"),
            wind_speed_ms=first_number("wind_speed_10m"),
            current_speed_ms=first_number("ocean_current_velocity"),
            raw_metadata={
                "provider": "Open-Meteo Marine",
                "latitude": payload.get("latitude"),
                "longitude": payload.get("longitude"),
                "units": payload.get("hourly_units", {}),
            },
        )
        return SourceResult(observation=observation)
