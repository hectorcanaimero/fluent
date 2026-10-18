import pytest
from fastapi.testclient import TestClient

TEST_TOKEN = "test-token"  # noqa: S105


@pytest.fixture(autouse=True)
def _env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERVIEW_AGENT_TOKEN", TEST_TOKEN)


@pytest.fixture
def client() -> TestClient:
    from app.main import app

    return TestClient(app)
