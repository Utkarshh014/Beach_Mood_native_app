from datetime import datetime, timezone

from app.models import OceanAdvisory, OceanObservation, ScoredObservation
from app.repository.supabase_repo import SupabaseRepository


class Query:
    def __init__(self, data=None):
        self.data = data or []
        self.calls = []

    def select(self, *columns):
        self.calls.append(("select", columns))
        return self

    def eq(self, *args):
        self.calls.append(("eq", args))
        return self

    def limit(self, value):
        self.calls.append(("limit", value))
        return self

    def update(self, row):
        self.calls.append(("update", row))
        return self

    def insert(self, row):
        self.calls.append(("insert", row))
        return self

    def upsert(self, row, on_conflict=None):
        self.calls.append(("upsert", row, on_conflict))
        return self

    def execute(self):
        return type("Response", (), {"data": self.data})()


class FakeClient:
    def __init__(self, existing=None):
        self.existing = existing or []
        self.tables = {}

    def table(self, name):
        if name not in self.tables:
            data = self.existing if name == "beach_conditions" else []
            self.tables[name] = Query(data)
        return self.tables[name]


def result():
    observation = OceanObservation(
        beach_slug="marina-beach",
        source="open-meteo-marine",
        valid_at=datetime(2026, 11, 5, 12, tzinfo=timezone.utc),
        fetched_at=datetime(2026, 11, 5, 12, 1, tzinfo=timezone.utc),
        wave_height_m=0.5,
        wind_speed_ms=4,
        current_speed_ms=0.1,
    )
    return ScoredObservation(
        observation=observation,
        status="Safe",
        risk_score=0,
        reason_codes=[],
        data_quality="good",
        scoring_version="test",
    )


def result_with_advisory():
    scored = result()
    scored.advisories = [
        OceanAdvisory(
            source="incois",
            source_alert_id="alert-1",
            beach_slug="marina-beach",
            alert_type="storm_surge",
            severity="warning",
            title="Storm surge",
            starts_at=datetime(2026, 11, 5, 11, tzinfo=timezone.utc),
        )
    ]
    return scored


def beach():
    return type(
        "Beach",
        (),
        {"id": "beach-1", "slug": "marina-beach"},
    )()


def test_condition_upsert_updates_existing_record_idempotently():
    client = FakeClient(existing=[{"id": "condition-1"}])
    repository = SupabaseRepository(client)

    repository.upsert_result(beach(), result())

    calls = client.tables["beach_conditions"].calls
    assert any(call[0] == "update" for call in calls)
    assert not any(call[0] == "insert" for call in calls)


def test_condition_upsert_inserts_when_record_is_new():
    client = FakeClient()
    repository = SupabaseRepository(client)

    repository.upsert_result(beach(), result())

    calls = client.tables["beach_conditions"].calls
    assert any(call[0] == "insert" for call in calls)
    assert any(call[0] == "update" for call in client.tables["beaches"].calls)


def test_advisory_upsert_uses_stable_conflict_key():
    client = FakeClient()
    repository = SupabaseRepository(client)

    repository.upsert_result(beach(), result_with_advisory())

    advisory_calls = client.tables["ocean_alerts"].calls
    upsert = next(call for call in advisory_calls if call[0] == "upsert")
    assert upsert[2] == "source,source_alert_id,beach_id"
