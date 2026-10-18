"""Llama a 9router y DuckDuckGo de verdad. Correr con `uv run pytest -m live`."""

import os

import pytest

from app.contract import PrepareOkResponse, PrepareRequest
from app.prepare.workflow import run_prepare

pytestmark = [
    pytest.mark.live,
    pytest.mark.skipif(
        not os.environ.get("NINEROUTER_API_KEY") or not os.environ.get("NINEROUTER_URL"),
        reason="requiere NINEROUTER_URL y NINEROUTER_API_KEY",
    ),
]


async def test_prepare_contra_9router() -> None:
    req = PrepareRequest(
        interviewId="live-1",
        type="mixed",
        offerText=(
            "Mercado Libre busca Senior Frontend Engineer en Buenos Aires (híbrido). "
            "React, TypeScript, micro-frontends, performance web y mentoría de devs junior."
        ),
        learnerLevel="B1",
        previousQuestions=["How do you optimize the performance of a React application?"],
    )
    plan = await run_prepare(req)
    assert isinstance(plan, PrepareOkResponse)
    PrepareOkResponse.model_validate(plan.model_dump())
    assert plan.usage.inputTokens > 0 and plan.usage.outputTokens > 0
