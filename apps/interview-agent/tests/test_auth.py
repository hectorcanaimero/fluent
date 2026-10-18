import pytest
from fastapi.testclient import TestClient

from tests.conftest import TEST_TOKEN


def test_sin_authorization_header_da_401(client: TestClient) -> None:
    response = client.post("/v1/prepare")
    assert response.status_code == 401


def test_token_incorrecto_da_401(client: TestClient) -> None:
    response = client.post("/v1/prepare", headers={"Authorization": "Bearer wrong-token"})
    assert response.status_code == 401


def test_token_correcto_pasa_auth(client: TestClient) -> None:
    response = client.post("/v1/prepare", headers={"Authorization": f"Bearer {TEST_TOKEN}"})
    assert response.status_code == 501


def test_bearer_en_minusculas_pasa_auth(client: TestClient) -> None:
    response = client.post("/v1/prepare", headers={"Authorization": f"bearer {TEST_TOKEN}"})
    assert response.status_code == 501


def test_bearer_no_ascii_da_401(client: TestClient) -> None:
    response = client.post("/v1/prepare", headers={"Authorization": "Bearer tökén".encode()})
    assert response.status_code == 401


@pytest.mark.parametrize("name", ["INTERVIEW_AGENT_TOKEN", "NINEROUTER_URL", "NINEROUTER_API_KEY"])
def test_falta_env_obligatoria_falla_al_arrancar(
    monkeypatch: pytest.MonkeyPatch, name: str
) -> None:
    from app.main import app

    monkeypatch.setenv(name, "")
    with pytest.raises(RuntimeError, match=name), TestClient(app):
        pass
