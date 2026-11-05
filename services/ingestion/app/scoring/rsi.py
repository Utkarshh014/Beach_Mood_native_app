from __future__ import annotations

from datetime import datetime, timezone

from app.models import (
    OceanAdvisory,
    OceanObservation,
    ScoredObservation,
    SuitabilityStatus,
)

SCORING_VERSION = "phase2-rsi-2026-11-03"
STALE_AFTER_HOURS = 6
WIND_CAUTION_KMH = 25.0
WIND_HAZARD_KMH = 40.0
HAZARD_ALERT_TYPES = {
    "tsunami",
    "high_swell",
    "swell_surge",
    "storm_surge",
    "dangerous_currents",
    "high_waves",
}


def _is_active(advisory: OceanAdvisory, now: datetime) -> bool:
    return advisory.starts_at <= now and (
        advisory.ends_at is None or advisory.ends_at > now
    )


def _is_hazard_advisory(advisory: OceanAdvisory) -> bool:
    return advisory.severity in {"warning", "emergency"} or (
        advisory.alert_type.lower().replace(" ", "_") in HAZARD_ALERT_TYPES
    )


def score_observation(
    observation: OceanObservation,
    advisories: list[OceanAdvisory] | None = None,
    *,
    now: datetime | None = None,
) -> ScoredObservation:
    evaluated_at = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    active_advisories = [
        advisory
        for advisory in advisories or []
        if _is_active(advisory, evaluated_at)
    ]
    reasons: list[str] = []
    risk_score = 0

    hazard_advisory = any(
        _is_hazard_advisory(advisory) for advisory in active_advisories
    )
    if hazard_advisory:
        reasons.append("ACTIVE_OFFICIAL_WARNING")

    wave = observation.wave_height_m
    if wave is None:
        reasons.append("MISSING_WAVE_HEIGHT")
    elif wave > 2.0:
        reasons.append("WAVE_HAZARD")
        risk_score += 3
    elif wave >= 1.0:
        reasons.append("WAVE_CAUTION")
        risk_score += 1

    wind_kmh = (
        None if observation.wind_speed_ms is None else observation.wind_speed_ms * 3.6
    )
    if wind_kmh is None:
        reasons.append("MISSING_WIND")
    elif wind_kmh > WIND_HAZARD_KMH:
        reasons.append("WIND_HAZARD")
        risk_score += 3
    elif wind_kmh >= WIND_CAUTION_KMH:
        reasons.append("WIND_CAUTION")
        risk_score += 1

    current = observation.current_speed_ms
    if current is None:
        reasons.append("MISSING_CURRENT")
    elif current > 0.6:
        reasons.append("CURRENT_HAZARD")
        risk_score += 3
    elif current >= 0.3:
        reasons.append("CURRENT_CAUTION")
        risk_score += 1

    if observation.peak_period_s is None:
        reasons.append("MISSING_PEAK_PERIOD")
    elif observation.peak_period_s > 12:
        reasons.append("LONG_PERIOD_SWELL")
        risk_score += 3

    age_hours = (evaluated_at - observation.valid_at).total_seconds() / 3600
    stale = age_hours > STALE_AFTER_HOURS
    if stale:
        reasons.append("STALE_DATA")

    has_missing_core = any(
        value is None
        for value in (
            observation.wave_height_m,
            observation.wind_speed_ms,
            observation.current_speed_ms,
        )
    )
    if has_missing_core:
        reasons.append("INCOMPLETE_CORE_DATA")

    if hazard_advisory or risk_score >= 3:
        status: SuitabilityStatus = "Hazard"
    elif (
        risk_score > 0
        or stale
        or has_missing_core
        or any(advisory.severity == "watch" for advisory in active_advisories)
    ):
        status = "Caution"
    else:
        status = "Safe"

    data_quality = "stale" if stale else ("partial" if has_missing_core else "good")
    return ScoredObservation(
        observation=observation,
        status=status,
        risk_score=risk_score,
        reason_codes=list(dict.fromkeys(reasons)),
        data_quality=data_quality,
        scoring_version=SCORING_VERSION,
        advisories=active_advisories,
    )
