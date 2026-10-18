from fastapi import Depends, FastAPI, HTTPException

from app.auth import require_token
from app.contract import PrepareRequest, PrepareResponse
from app.prepare.designer import DesignFailed
from app.prepare.workflow import run_prepare

app = FastAPI(title="interview-agent")


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
def feedback() -> None:
    raise HTTPException(status_code=501, detail="not implemented")
