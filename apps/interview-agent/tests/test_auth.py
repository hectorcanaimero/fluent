from fastapi.testclient import TestClient

from tests.conftest import TEST_TOKEN


def test_sin_authorization_header_da_401(client: TestClient) -> None:
    response = client.post("/v1/prepare")
    assert response.status_code == 401


def test_token_incorrecto_da_401(client: TestClient) -> None:
    response = client.post(
        "/v1/prepare", headers={"Authorization": "Bearer wrong-token"}
    )
    assert response.status_code == 401


def test_token_correcto_pasa_auth(client: TestClient) -> None:
    response = client.post(
        "/v1/prepare", headers={"Authorization": f"Bearer {TEST_TOKEN}"}
    )
    assert response.status_code == 501
