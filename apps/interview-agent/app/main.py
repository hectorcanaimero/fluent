from fastapi import Depends, FastAPI, HTTPException

from app.auth import require_token

app = FastAPI(title="interview-agent")


@app.get("/healthz")
def healthz() -> dict[str, bool]:
    return {"ok": True}


@app.post("/v1/prepare", dependencies=[Depends(require_token)])
def prepare() -> None:
    raise HTTPException(status_code=501, detail="not implemented")


@app.post("/v1/feedback", dependencies=[Depends(require_token)])
def feedback() -> None:
    raise HTTPException(status_code=501, detail="not implemented")
