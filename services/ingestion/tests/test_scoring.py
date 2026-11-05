from datetime import datetime, timedelta, timezone

import pytest

from app.models import OceanAdvisory, OceanObservation
from app.scoring.rsi import score_observation

NOW = datetime(2026, 11, 3, 12, 0, tzinfo=timezone.utc)


def observation(**changes) -> OceanObservation:
    values = {
        "beach_slug": "test-beach",
        "source": "test",
        "valid_at": NOW,
        "fetched_at": NOW,
        "wave_height_m": 0.5,
        "swell_height_m": 0.3,
        "peak_period_s": 8.0,
        "wind_speed_ms": 5 / 3.6,
        "current_speed_ms": 0.2,
    }
    values.update(changes)
    return OceanObservation(**values)


def advisory(severity="warning", alert_type="storm_surge") -> OceanAdvisory:
    return OceanAdvisory(
        source="incois",
        source_alert_id="alert-1",
        beach_slug="test-beach",
        alert_type=alert_type,
        severity=severity,
        title="Test advisory",
        starts_at=NOW - timedelta(minutes=5),
        ends_at=NOW + timedelta(hours=1),
    )


def test_safe_at_safe_boundaries():
    result = score_observation(observation(), now=NOW)
    assert result.status == "Safe"
    assert result.risk_score == 0


@pytest.mark.parametrize(
    ("changes", "reason"),
    [
        ({"wave_height_m": 1.0}, "WAVE_CAUTION"),
        ({"wind_speed_ms": 25 / 3.6}, "WIND_CAUTION"),
        ({"current_speed_ms": 0.3}, "CURRENT_CAUTION"),
    ],
)
def test_caution_at_boundaries(changes, reason):
    result = score_observation(observation(**changes), now=NOW)
    assert result.status == "Caution"
    assert reason in result.reason_codes


def test_upper_caution_boundaries_are_not_hazard():
    wave_result = score_observation(observation(wave_height_m=2.0), now=NOW)
    wind_result = score_observation(observation(wind_speed_ms=40 / 3.6), now=NOW)
    assert wave_result.status == "Caution"
    assert wind_result.status == "Caution"


@pytest.mark.parametrize(
    ("changes", "reason"),
    [
        ({"wave_height_m": 2.01}, "WAVE_HAZARD"),
        ({"wind_speed_ms": 40.01 / 3.6}, "WIND_HAZARD"),
        ({"current_speed_ms": 0.61}, "CURRENT_HAZARD"),
        ({"peak_period_s": 12.01}, "LONG_PERIOD_SWELL"),
    ],
)
def test_hazard_parameter_boundaries(changes, reason):
    result = score_observation(observation(**changes), now=NOW)
    assert result.status == "Hazard"
    assert reason in result.reason_codes


def test_active_hazard_advisory_overrides_safe_parameters():
    result = score_observation(observation(), [advisory()], now=NOW)
    assert result.status == "Hazard"
    assert "ACTIVE_OFFICIAL_WARNING" in result.reason_codes


def test_watch_advisory_forces_caution():
    result = score_observation(observation(), [advisory("watch", "coastal_notice")], now=NOW)
    assert result.status == "Caution"


def test_expired_advisory_does_not_override():
    expired = advisory()
    expired.ends_at = NOW - timedelta(minutes=1)
    result = score_observation(observation(), [expired], now=NOW)
    assert result.status == "Safe"


def test_missing_core_data_is_not_safe():
    result = score_observation(observation(current_speed_ms=None), now=NOW)
    assert result.status == "Caution"
    assert result.data_quality == "partial"


def test_stale_data_is_not_safe():
    result = score_observation(
        observation(valid_at=NOW - timedelta(hours=7)),
        now=NOW,
    )
    assert result.status == "Caution"
    assert result.data_quality == "stale"
