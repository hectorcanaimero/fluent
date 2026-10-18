"""Auth de /v1/*: Authorization: Bearer <INTERVIEW_AGENT_TOKEN>, comparación en tiempo constante."""

import hmac
import os

from fastapi import Header, HTTPException


def require_token(authorization: str | None = Header(default=None)) -> None:
    expected = os.environ.get("INTERVIEW_AGENT_TOKEN", "")
    prefix = "Bearer "
    if not authorization or not authorization.startswith(prefix):
        raise HTTPException(status_code=401, detail="missing bearer token")
    token = authorization[len(prefix) :]
    if not expected or not hmac.compare_digest(token, expected):
        raise HTTPException(status_code=401, detail="invalid token")
