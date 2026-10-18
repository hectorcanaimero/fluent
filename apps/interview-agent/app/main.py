import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException

from app.auth import require_token

REQUIRED_ENV = ("INTERVIEW_AGENT_TOKEN", "NINEROUTER_URL", "NINEROUTER_API_KEY")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    missing = [name for name in REQUIRED_ENV if not os.environ.get(name)]
    if missing:
        raise RuntimeError(f"missing required env vars: {', '.join(missing)}")
    yield


app = FastAPI(title="interview-agent", lifespan=lifespan)


@app.get("/healthz")
def healthz() -> dict[str, bool]:
    return {"ok": True}


@app.post("/v1/prepare", dependencies=[Depends(require_token)])
def prepare() -> None:
    raise HTTPException(status_code=501, detail="not implemented")


@app.post("/v1/feedback", dependencies=[Depends(require_token)])
def feedback() -> None:
    raise HTTPException(status_code=501, detail="not implemented")
