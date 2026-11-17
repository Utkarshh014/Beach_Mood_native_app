import asyncio
import json
from types import SimpleNamespace

from app import main


def test_empty_catalogue_is_failure(monkeypatch, tmp_path):
    settings = SimpleNamespace(supabase_url="https://example.test", supabase_service_role_key="test")
    monkeypatch.setattr(main.Settings, "from_env", lambda: settings)
    monkeypatch.setattr(main, "create_client", lambda *_: object())
    monkeypatch.setattr(main, "SupabaseRepository", lambda _: SimpleNamespace(list_beaches=lambda: []))
    destination = tmp_path / "summary.md"
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(destination))
    assert asyncio.run(main.run()) == 1
    assert '"expected": 0' in destination.read_text()


def test_health_summary_distinguishes_process_success_from_data_quality(monkeypatch, tmp_path):
    destination = tmp_path / "summary.md"
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(destination))
    main._write_health_summary(2, 2, 0, [
        {"beach": "a", "data_quality": "stale"},
        {"beach": "b", "data_quality": "partial"},
    ])
    content = destination.read_text()
    summary = json.loads(content.split("```json\n")[1].split("\n```")[0])
    assert summary["stale"] == 1
    assert summary["partial"] == 1
    assert summary["synced"] == 2
