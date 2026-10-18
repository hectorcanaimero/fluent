"""Auth de /v1/*: Authorization: Bearer <INTERVIEW_AGENT_TOKEN>, comparación en tiempo constante."""

import hmac
import os

from fastapi import Header, HTTPException


def require_token(authorization: str | None = Header(default=None)) -> None:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="missing bearer token")
    # Bytes: compare_digest con str no ASCII lanza TypeError (500).
    expected = os.environ["INTERVIEW_AGENT_TOKEN"]
    if not hmac.compare_digest(token.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="invalid token")
