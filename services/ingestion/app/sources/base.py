from __future__ import annotations

import asyncio
import random
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol

import httpx

from app.models import Beach, OceanAdvisory, OceanObservation


@dataclass
class SourceResult:
    observation: OceanObservation
    advisories: list[OceanAdvisory] = field(default_factory=list)


class MarineSource(Protocol):
    name: str

    async def fetch(self, beach: Beach) -> SourceResult:
        ...


def parse_timestamp(value: Any, fallback: datetime) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    else:
        parsed = fallback
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


async def request_json(
    client: httpx.AsyncClient,
    url: str,
    *,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    retries: int = 3,
) -> Any:
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            response = await client.get(url, params=params, headers=headers)
            response.raise_for_status()
            return response.json()
        except (httpx.HTTPError, ValueError) as error:
            last_error = error
            if attempt + 1 < retries:
                await asyncio.sleep(min(8.0, 2**attempt) + random.uniform(0, 0.25))
                continue
    raise RuntimeError(f"Marine source request failed: {url}") from last_error
