"""Workflow Agno de preparación: Investigador → Diseñador (C1, I1)."""

from agno.workflow import Step, Workflow
from agno.workflow.types import StepInput, StepOutput

from app.contract import (
    PrepareOkResponse,
    PrepareRequest,
    PrepareResponse,
    PrepareUnreadableResponse,
    Usage,
)
from app.models import build_model
from app.prepare.designer import DesignFailed, design_plan
from app.prepare.researcher import OfferUnreadable, ResearchResult, fetch_offer, research_offer


async def _research_step(step_input: StepInput) -> StepOutput:
    req: PrepareRequest = step_input.additional_data["request"]
    offer_text = req.offerText or ""
    if req.offerUrl:
        try:
            fetched = await fetch_offer(req.offerUrl)
        except OfferUnreadable as exc:
            return StepOutput(content=PrepareUnreadableResponse(reason=exc.reason), stop=True)
        offer_text = f"{offer_text}\n\n{fetched}".strip()
    result = await research_offer(offer_text)
    return StepOutput(content=(offer_text, result))


async def _design_step(step_input: StepInput) -> StepOutput:
    req: PrepareRequest = step_input.additional_data["request"]
    offer_text: str
    research: ResearchResult
    offer_text, research = step_input.previous_step_content
    usage = Usage(model=build_model().id, inputTokens=0, outputTokens=0, searchCalls=0)
    try:
        designed = await design_plan(req, offer_text, research.research, usage)
    except DesignFailed as exc:
        return StepOutput(content=exc, success=False, error=str(exc), stop=True)
    usage = usage.model_copy(
        update={
            "inputTokens": research.input_tokens + designed.input_tokens,
            "outputTokens": research.output_tokens + designed.output_tokens,
            "searchCalls": research.search_calls,
        }
    )
    return StepOutput(content=designed.plan.model_copy(update={"usage": usage}))


async def run_prepare(req: PrepareRequest) -> PrepareResponse:
    """Lanza DesignFailed si el plan no cumple los invariantes tras el reintento."""
    workflow = Workflow(
        name="interview-prepare",
        steps=[
            # Los pasos manejan sus propios reintentos; los de Agno duplicarían llamadas.
            Step(name="researcher", executor=_research_step, max_retries=0),
            Step(name="designer", executor=_design_step, max_retries=0),
        ],
        telemetry=False,
    )
    run = await workflow.arun(input=req.interviewId, additional_data={"request": req})
    content = run.content
    if isinstance(content, (PrepareOkResponse, PrepareUnreadableResponse)):
        return content
    if isinstance(content, DesignFailed):
        raise content
    raise DesignFailed(f"workflow ended without a plan: {content!r}")
