from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    incois_api_url: str | None
    incois_api_token: str | None
    open_meteo_base_url: str
    http_timeout_seconds: float
    http_retries: int

    @classmethod
    def from_env(cls) -> "Settings":
        def required(name: str) -> str:
            value = os.getenv(name)
            if not value:
                raise ValueError(f"Missing required environment variable: {name}")
            return value

        retries = int(os.getenv("HTTP_RETRIES", "3"))
        if retries < 1 or retries > 5:
            raise ValueError("HTTP_RETRIES must be between 1 and 5")

        timeout = float(os.getenv("HTTP_TIMEOUT_SECONDS", "20"))
        if timeout <= 0 or timeout > 120:
            raise ValueError("HTTP_TIMEOUT_SECONDS must be between 0 and 120")

        return cls(
            supabase_url=required("SUPABASE_URL").rstrip("/"),
            supabase_service_role_key=required("SUPABASE_SERVICE_ROLE_KEY"),
            incois_api_url=os.getenv("INCOIS_API_URL") or None,
            incois_api_token=os.getenv("INCOIS_API_TOKEN") or None,
            open_meteo_base_url=os.getenv(
                "OPEN_METEO_BASE_URL",
                "https://marine-api.open-meteo.com/v1/marine",
            ).rstrip("/"),
            http_timeout_seconds=timeout,
            http_retries=retries,
        )
