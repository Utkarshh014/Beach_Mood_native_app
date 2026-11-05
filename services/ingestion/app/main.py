from __future__ import annotations

import asyncio
import logging

import httpx
from supabase import create_client

from app.config import Settings
from app.repository.supabase_repo import SupabaseRepository
from app.scoring.rsi import score_observation
from app.sources.base import MarineSource
from app.sources.incois import IncoisSource
from app.sources.open_meteo import OpenMeteoMarineSource

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


async def run() -> int:
    settings = Settings.from_env()
    supabase = create_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )
    repository = SupabaseRepository(supabase)
    beaches = repository.list_beaches()
    synced = 0
    failed = 0
    async with httpx.AsyncClient(timeout=settings.http_timeout_seconds) as client:
        fallback = OpenMeteoMarineSource(
            client, settings.open_meteo_base_url, settings.http_retries
        )
        primary: MarineSource | None = (
            IncoisSource(
                client,
                settings.incois_api_url,
                settings.incois_api_token,
                settings.http_retries,
            )
            if settings.incois_api_url
            else None
        )
        for beach in beaches:
            try:
                result = await _fetch_with_fallback(primary, fallback, beach)
                existing_advisories = repository.list_active_advisories(beach)
                advisories = _merge_advisories(existing_advisories, result.advisories)
                scored = score_observation(result.observation, advisories)
                repository.upsert_result(beach, scored)
                synced += 1
                logger.info("%s: %s (%s)", beach.slug, scored.status, result.observation.source)
            except Exception:
                failed += 1
                logger.exception("Failed to sync %s; existing data preserved", beach.slug)
    logger.info("Ingestion complete: synced=%d failed=%d total=%d", synced, failed, len(beaches))
    return 1 if failed else 0


async def _fetch_with_fallback(primary: MarineSource | None, fallback: MarineSource, beach):
    if primary is not None:
        try:
            return await primary.fetch(beach)
        except Exception:
            logger.warning("INCOIS unavailable for %s; using Open-Meteo fallback", beach.slug)
    return await fallback.fetch(beach)


def _merge_advisories(existing, incoming):
    merged = {advisory.source_alert_id: advisory for advisory in existing}
    merged.update({advisory.source_alert_id: advisory for advisory in incoming})
    return list(merged.values())


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run()))
