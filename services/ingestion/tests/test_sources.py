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


NOW = datetime(2026, 11, 5, 12, 30, tzinfo=timezone.utc)


def marine():
    return {
        "hourly": {
            "time": ["2026-11-05T00:00", "2026-11-05T12:00", "2026-11-05T13:00"],
            "wave_height": [4.0, 0.5, 6.0],
            "swell_wave_height": [0.8, 0.3, 1.0],
            "swell_wave_peak_period": [9.5, 8.0, 14.0],
            "ocean_current_velocity": [3.6, 0.72, 7.2],
        },
        "hourly_units": {"wave_height": "m", "swell_wave_height": "m", "swell_wave_peak_period": "s", "ocean_current_velocity": "km/h"},
    }


def weather(unit="m/s", value=4.0):
    return {"hourly": {"time": ["2026-11-05T12:00"], "wind_speed_10m": [value]}, "hourly_units": {"wind_speed_10m": unit}}


def fetch(marine_payload, weather_payload):
    client = FakeAsyncClient([response(marine_payload), response(weather_payload)])
    source = OpenMeteoMarineSource(client, "https://marine.example", retries=1)
    return asyncio.run(source.fetch(BEACH, now=NOW)).observation


def test_selects_current_hour_and_converts_units():
    result = fetch(marine(), weather())
    assert result.wave_height_m == 0.5
    assert result.current_speed_ms == pytest.approx(0.2)
    assert result.wind_speed_ms == 4.0
    assert result.peak_period_s == 8.0
    assert result.valid_at == NOW.replace(minute=0)
    assert result.raw_metadata["components"]["weather"]["valid_at"]


@pytest.mark.parametrize(("unit", "value"), [("m/s", 4), ("km/h", 14.4)])
def test_velocity_units_give_equivalent_scores(unit, value):
    from app.scoring.rsi import score_observation
    observation = fetch(marine(), weather(unit, value))
    assert observation.wind_speed_ms == pytest.approx(4.0)
    assert score_observation(observation, now=NOW).status == "Safe"


def test_weather_failure_preserves_marine_as_partial():
    from app.scoring.rsi import score_observation
    client = FakeAsyncClient([response(marine()), httpx.ReadTimeout("offline")])
    source = OpenMeteoMarineSource(client, "https://marine.example", retries=1)
    result = asyncio.run(source.fetch(BEACH, now=NOW)).observation
    assert result.wave_height_m == 0.5
    assert result.wind_speed_ms is None
    assert score_observation(result, now=NOW).data_quality == "partial"
    assert score_observation(result, now=NOW).status == "Caution"


def test_marine_failure_preserves_wind_as_partial():
    result = fetch({}, weather())
    assert result.wind_speed_ms == 4.0
    assert result.wave_height_m is None


@pytest.mark.parametrize("mutation", ["missing_time", "future", "unsorted", "short_series", "bad_unit", "negative"])
def test_invalid_marine_cannot_appear_complete(mutation):
    payload = marine()
    if mutation == "missing_time":
        del payload["hourly"]["time"]
    elif mutation == "future":
        payload["hourly"]["time"] = ["2027-01-01T00:00", "2027-01-01T01:00", "2027-01-01T02:00"]
    elif mutation == "unsorted":
        payload["hourly"]["time"].reverse()
    elif mutation == "short_series":
        payload["hourly"]["wave_height"] = [1]
    elif mutation == "bad_unit":
        payload["hourly_units"]["ocean_current_velocity"] = "unknown"
    else:
        payload["hourly"]["wave_height"][1] = -1
    result = fetch(payload, weather())
    assert result.wave_height_m is None
    assert "marine" in result.raw_metadata["unavailable_components"]


def test_nonfinite_measurement_rejected():
    with pytest.raises(ValueError):
        OpenMeteoMarineSource._number({"time": ["x"], "x": [float("nan")]}, {"x": "m"}, "x", "length", 0)


def test_both_sources_invalid_raise():
    with pytest.raises(ValueError, match="no usable core"):
        fetch({}, {})


def test_oldest_component_controls_validity():
    payload = weather()
    payload["hourly"]["time"] = ["2026-11-05T03:00"]
    result = fetch(marine(), payload)
    assert result.valid_at.hour == 3
    assert result.raw_metadata["components"]["marine"]["valid_at"].endswith("12:00:00+00:00")


def test_requests_use_separate_endpoints_and_peak_period():
    requests = []
    def handler(request):
        requests.append(request)
        return response(weather() if request.url.host == "weather.example" else marine())
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            source = OpenMeteoMarineSource(client, "https://marine.example", weather_url="https://weather.example")
            await source.fetch(BEACH, now=NOW)
    asyncio.run(run())
    marine_request = next(r for r in requests if r.url.host == "marine.example")
    weather_request = next(r for r in requests if r.url.host == "weather.example")
    assert "wind_speed_10m" not in marine_request.url.params["hourly"]
    assert "swell_wave_peak_period" in marine_request.url.params["hourly"]
    assert weather_request.url.params["wind_speed_unit"] == "ms"


@pytest.mark.parametrize("timestamp", [None, "2026-11-05T12:00", "2099-01-01T00:00:00Z"])
def test_incois_rejects_missing_ambiguous_or_future_time(timestamp):
    from app.sources.incois import IncoisSource
    client = FakeAsyncClient([response({"valid_at": timestamp, "wave_height_m": 0.5})])
    with pytest.raises(ValueError):
        asyncio.run(IncoisSource(client, "https://example.test", None, retries=1).fetch(BEACH))


def test_empty_incois_measurements_trigger_fallback():
    from app.sources.incois import IncoisSource
    client = FakeAsyncClient([response({"valid_at": "2026-01-01T00:00:00Z"})])
    with pytest.raises(ValueError, match="no usable core"):
        asyncio.run(IncoisSource(client, "https://example.test", None, retries=1).fetch(BEACH))
