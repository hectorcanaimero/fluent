import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException

from app.auth import require_token
from app.contract import FeedbackRequest, FeedbackResponse, PrepareRequest, PrepareResponse
from app.feedback.evaluator import FeedbackFailed, generate_feedback
from app.prepare.designer import DesignFailed
from app.prepare.workflow import run_prepare

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
async def prepare(req: PrepareRequest) -> PrepareResponse:
    if not (req.offerText or "").strip() and not req.offerUrl:
        raise HTTPException(status_code=422, detail="offerText or offerUrl is required")
    try:
        return await run_prepare(req)
    except DesignFailed as exc:
        raise HTTPException(status_code=502, detail=f"plan generation failed: {exc}") from exc


@app.post("/v1/feedback", dependencies=[Depends(require_token)])
async def feedback(req: FeedbackRequest) -> FeedbackResponse:
    try:
        return await generate_feedback(req)
    except FeedbackFailed as exc:
        # El motivo queda en el log; al cliente, nada interno.
        raise HTTPException(status_code=502, detail="feedback generation failed") from exc
