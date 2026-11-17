from __future__ import annotations

import asyncio
import math
from datetime import datetime, timezone
from typing import Any

import httpx

from app.models import Beach, OceanObservation
from app.sources.base import SourceResult, request_json


class OpenMeteoMarineSource:
    name = "open-meteo-marine"

    def __init__(
        self,
        client: httpx.AsyncClient,
        base_url: str,
        retries: int = 3,
        *,
        weather_url: str = "https://api.open-meteo.com/v1/forecast",
    ) -> None:
        self.client = client
        self.base_url = base_url
        self.weather_url = weather_url
        self.retries = retries

    async def fetch(self, beach: Beach, *, now: datetime | None = None) -> SourceResult:
        evaluated_at = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
        common = {
            "latitude": beach.latitude,
            "longitude": beach.longitude,
            "forecast_days": 1,
            "timezone": "UTC",
        }
        # Separate endpoints: a failed weather request must not erase valid waves.
        responses = await asyncio.gather(
            request_json(
                self.client, self.base_url,
                params={**common, "hourly": "wave_height,swell_wave_height,swell_wave_peak_period,ocean_current_velocity"},
                retries=self.retries,
            ),
            request_json(
                self.client, self.weather_url,
                params={**common, "hourly": "wind_speed_10m", "wind_speed_unit": "ms"},
                retries=self.retries,
            ),
            return_exceptions=True,
        )
        values: dict[str, float | None] = {}
        metadata: dict[str, Any] = {"provider": "Open-Meteo", "components": {}, "unavailable_components": []}
        valid_times: list[datetime] = []
        mappings = {
            "marine": {
                "wave_height_m": ("wave_height", "length"),
                "swell_height_m": ("swell_wave_height", "length"),
                "peak_period_s": ("swell_wave_peak_period", "period"),
                "current_speed_ms": ("ocean_current_velocity", "velocity"),
            },
            "weather": {"wind_speed_ms": ("wind_speed_10m", "velocity")},
        }
        for component, payload in zip(mappings, responses):
            try:
                if isinstance(payload, BaseException):
                    raise ValueError("source request failed") from payload
                hourly, units, index, valid_at = self._hour(payload, evaluated_at)
                component_values = {
                    target: self._number(hourly, units, key, kind, index)
                    for target, (key, kind) in mappings[component].items()
                }
                if not any(value is not None for value in component_values.values()):
                    raise ValueError("source contains no usable measurements")
                values.update(component_values)
                valid_times.append(valid_at)
                metadata["components"][component] = {
                    "valid_at": valid_at.isoformat(),
                    "units": units,
                    "latitude": payload.get("latitude"),
                    "longitude": payload.get("longitude"),
                }
            except (ValueError, TypeError, OverflowError):
                metadata["unavailable_components"].append(component)

        if not valid_times or not any(
            values.get(key) is not None
            for key in ("wave_height_m", "current_speed_ms", "wind_speed_ms")
        ):
            raise ValueError("Open-Meteo returned no usable core measurements with valid timestamps and units")
        return SourceResult(observation=OceanObservation(
            beach_slug=beach.slug,
            source=self.name,
            # The oldest component controls freshness; downloading it again cannot renew it.
            valid_at=min(valid_times),
            fetched_at=datetime.now(timezone.utc),
            raw_metadata=metadata,
            **values,
        ))

    @staticmethod
    def _hour(payload: Any, now: datetime):
        if not isinstance(payload, dict) or payload.get("utc_offset_seconds", 0) != 0:
            raise ValueError("Expected an object in UTC")
        hourly = payload.get("hourly")
        units = payload.get("hourly_units")
        if not isinstance(hourly, dict) or not isinstance(units, dict):
            raise ValueError("Missing hourly data or units")
        times = hourly.get("time")
        if not isinstance(times, list) or not times:
            raise ValueError("Missing valid times")
        parsed = []
        for value in times:
            if not isinstance(value, str):
                raise ValueError("Invalid timestamp")
            timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
            # Naive ISO times are explicitly UTC because the request asks for UTC.
            parsed.append(timestamp.replace(tzinfo=timezone.utc) if timestamp.tzinfo is None else timestamp.astimezone(timezone.utc))
        if any(a >= b for a, b in zip(parsed, parsed[1:])):
            raise ValueError("Unordered or duplicate timestamps")
        candidates = [i for i, timestamp in enumerate(parsed) if timestamp <= now]
        if not candidates:
            raise ValueError("No currently valid forecast hour")
        index = candidates[-1]
        return hourly, units, index, parsed[index]

    @staticmethod
    def _number(hourly, units, key, kind, index) -> float | None:
        series = hourly.get(key)
        if series is None:
            return None
        if not isinstance(series, list) or len(series) != len(hourly["time"]):
            raise ValueError("Misaligned measurement series")
        value = series[index]
        if value is None:
            return None
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
            raise ValueError("Invalid measurement")
        factors = {
            "length": {"m": 1.0},
            "period": {"s": 1.0},
            "velocity": {"m/s": 1.0, "km/h": 1 / 3.6, "mph": 0.44704, "kn": 0.514444, "knots": 0.514444},
        }
        unit = units.get(key)
        if unit not in factors[kind]:
            raise ValueError("Missing or unsupported unit")
        return float(value) * factors[kind][unit]
