import asyncio
from datetime import datetime, timezone

import httpx
import pytest

from app.models import Beach
from app.sources.base import request_json
from app.sources.open_meteo import OpenMeteoMarineSource


BEACH = Beach(
    id="beach-1",
    slug="marina-beach",
    name="Marina Beach",
    latitude=13.05,
    longitude=80.28,
)


class FakeAsyncClient:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.calls = 0

    async def get(self, url, *, params=None, headers=None):
        self.calls += 1
        response = next(self.responses)
        if isinstance(response, Exception):
            raise response
        return response


def response(payload, status_code=200):
    return httpx.Response(
        status_code,
        json=payload,
        request=httpx.Request("GET", "https://example.test"),
    )


def test_request_json_retries_transient_timeout(monkeypatch):
    client = FakeAsyncClient(
        [
            httpx.ReadTimeout("timed out"),
            response({"ok": True}),
        ]
    )
    async def no_sleep(_):
        return None

    monkeypatch.setattr("app.sources.base.asyncio.sleep", no_sleep)
    monkeypatch.setattr("app.sources.base.random.uniform", lambda *_: 0)

    payload = asyncio.run(
        request_json(client, "https://example.test", retries=2)
    )

    assert payload == {"ok": True}
    assert client.calls == 2


def test_request_json_raises_after_malformed_json(monkeypatch):
    client = FakeAsyncClient(
        [
            httpx.Response(
                200,
                content=b"{malformed",
                request=httpx.Request("GET", "https://example.test"),
            )
        ]
    )

    with pytest.raises(RuntimeError, match="Marine source request failed"):
        asyncio.run(request_json(client, "https://example.test", retries=1))


def test_open_meteo_normalizes_hourly_payload():
    client = FakeAsyncClient(
        [
            response(
                {
                    "latitude": BEACH.latitude,
                    "longitude": BEACH.longitude,
                    "hourly": {
                        "time": ["2026-11-05T12:00"],
                        "wave_height": [1.25],
                        "swell_wave_height": [0.8],
                        "swell_wave_period": [9.5],
                        "wind_speed_10m": [7.0],
                        "ocean_current_velocity": [0.35],
                    },
                    "hourly_units": {"wave_height": "m"},
                }
            )
        ]
    )
    source = OpenMeteoMarineSource(client, "https://marine.example", retries=1)

    result = asyncio.run(source.fetch(BEACH))

    assert result.observation.beach_slug == BEACH.slug
    assert result.observation.wave_height_m == 1.25
    assert result.observation.peak_period_s == 9.5
    assert result.observation.wind_speed_ms == 7.0
    assert result.observation.current_speed_ms == 0.35
    assert result.observation.valid_at == datetime(
        2026, 11, 5, 12, tzinfo=timezone.utc
    )


def test_open_meteo_rejects_missing_hourly_schema():
    client = FakeAsyncClient([response({"latitude": BEACH.latitude})])
    source = OpenMeteoMarineSource(client, "https://marine.example", retries=1)

    with pytest.raises(ValueError, match="no hourly data"):
        asyncio.run(source.fetch(BEACH))
