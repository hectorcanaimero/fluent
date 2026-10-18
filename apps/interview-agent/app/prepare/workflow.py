"""Workflow Agno de preparación: Investigador → Diseñador (C1, I1)."""

from agno.workflow import Step, Workflow
from agno.workflow.types import StepInput, StepOutput

from app.contract import (
    PrepareOkResponse,
    PrepareRequest,
    PrepareResponse,
    PrepareUnreadableResponse,
)
from app.prepare.designer import DesignFailed, design_plan
from app.prepare.researcher import OfferUnreadable, ResearchResult, fetch_offer, research_offer

MAX_OFFER_CHARS = 20_000
TRUNCATED_NOTE = f"(offer text truncated to {MAX_OFFER_CHARS} characters)"


async def _research_step(step_input: StepInput) -> StepOutput:
    req: PrepareRequest = step_input.additional_data["request"]
    offer_text = (req.offerText or "").strip()
    if not offer_text:  # el texto pegado manda; la URL solo se descarga si no hay texto
        try:
            offer_text = await fetch_offer(req.offerUrl or "")
        except OfferUnreadable as exc:
            return StepOutput(content=PrepareUnreadableResponse(reason=exc.reason), stop=True)
    truncated = len(offer_text) > MAX_OFFER_CHARS
    offer_text = offer_text[:MAX_OFFER_CHARS]
    if req.offerUrl and req.offerText:
        offer_text += f"\n\nOffer URL: {req.offerUrl}"
    result = await research_offer(offer_text)
    if truncated:
        notes = f"{result.research.notes}\n{TRUNCATED_NOTE}".strip()
        result.research = result.research.model_copy(update={"notes": notes})
    return StepOutput(content=(offer_text, result))


async def _design_step(step_input: StepInput) -> StepOutput:
    req: PrepareRequest = step_input.additional_data["request"]
    offer_text: str
    research: ResearchResult
    offer_text, research = step_input.previous_step_content
    try:
        plan = await design_plan(req, offer_text, research)
    except DesignFailed as exc:
        return StepOutput(content=exc, success=False, error=str(exc), stop=True)
    return StepOutput(content=plan)


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
