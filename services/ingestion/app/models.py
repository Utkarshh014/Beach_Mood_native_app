from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

AlertSeverity = Literal["info", "watch", "warning", "emergency"]
SuitabilityStatus = Literal["Safe", "Caution", "Hazard"]
DataQuality = Literal["good", "partial", "stale", "unknown"]


class Beach(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    slug: str
    name: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class OceanObservation(BaseModel):
    model_config = ConfigDict(extra="allow")

    beach_slug: str
    source: str
    valid_at: datetime
    fetched_at: datetime
    wave_height_m: float | None = Field(default=None, ge=0, le=30)
    swell_height_m: float | None = Field(default=None, ge=0, le=30)
    peak_period_s: float | None = Field(default=None, ge=0, le=40)
    wind_speed_ms: float | None = Field(default=None, ge=0, le=100)
    current_speed_ms: float | None = Field(default=None, ge=0, le=10)
    water_quality: str | None = None
    raw_metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("valid_at", "fetched_at")
    @classmethod
    def require_utc_timestamp(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("timestamps must include timezone")
        return value.astimezone(timezone.utc)


class OceanAdvisory(BaseModel):
    model_config = ConfigDict(extra="allow")

    source: str
    source_alert_id: str
    beach_slug: str
    alert_type: str
    severity: AlertSeverity
    title: str
    description: str | None = None
    starts_at: datetime
    ends_at: datetime | None = None
    source_url: str | None = None

    @field_validator("starts_at", "ends_at")
    @classmethod
    def require_utc_timestamp(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("timestamps must include timezone")
        return value.astimezone(timezone.utc)


class ScoredObservation(BaseModel):
    observation: OceanObservation
    status: SuitabilityStatus
    risk_score: int = Field(ge=0)
    reason_codes: list[str]
    data_quality: DataQuality
    scoring_version: str
    advisories: list[OceanAdvisory] = Field(default_factory=list)
