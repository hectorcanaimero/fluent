from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

TEST_TOKEN = "test-token"  # noqa: S105


@pytest.fixture(autouse=True)
def _env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERVIEW_AGENT_TOKEN", TEST_TOKEN)
    monkeypatch.setenv("NINEROUTER_URL", "http://9router.test")
    monkeypatch.setenv("NINEROUTER_API_KEY", "test-key")


@pytest.fixture
def client() -> Iterator[TestClient]:
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
