import pytest
from pydantic import ValidationError

from app.contract import (
    Company,
    InterviewFeedback,
    PrepareOkResponse,
    Question,
    Research,
    RubricItem,
    Usage,
)

RUBRIC = [
    RubricItem(id=f"c{i}", name=f"competencia {i}", expectedLevel="semi_senior", weight=1)
    for i in range(1, 5)
]
USAGE = Usage(model="fluent-pro", inputTokens=0, outputTokens=0, searchCalls=0)


def _questions(kinds: list[str]) -> list[Question]:
    return [
        Question(idx=i + 1, competencyId=RUBRIC[i % len(RUBRIC)].id, kind=kind, text=f"q{i}")
        for i, kind in enumerate(kinds)
    ]


def _response(questions: list[Question]) -> PrepareOkResponse:
    return PrepareOkResponse(
        research=Research(found=True, notes="n/a"),
        company=Company(name="Acme"),
        role="Backend engineer",
        area="engineering",
        seniority="semi_senior",
        stack=["python"],
        rubric=RUBRIC,
        questions=questions,
        usage=USAGE,
    )


def test_plan_valido_pasa() -> None:
    questions = _questions(["technical"] * 8)
    _response(questions)


def test_7_preguntas_es_rechazado() -> None:
    with pytest.raises(ValidationError):
        _response(_questions(["technical"] * 7))


def test_mixed_con_1_conductual_es_rechazado() -> None:
    questions = _questions(["behavioral"] + ["technical"] * 7)
    with pytest.raises(ValidationError):
        PrepareOkResponse.model_validate(
            _response(questions).model_dump(), context={"type": "mixed"}
        )


def test_mixed_con_2_conductuales_pasa() -> None:
    questions = _questions(["behavioral", "behavioral"] + ["technical"] * 6)
    PrepareOkResponse.model_validate(
        _response(questions).model_dump(), context={"type": "mixed"}
    )


def test_feedback_con_study_plan_de_4_es_rechazado() -> None:
    feedback_kwargs = dict(
        summary="ok",
        competencies=[],
        english={
            "clarity": {"rating": "good", "note": "n/a"},
            "vocabulary": {"rating": "good", "note": "n/a"},
            "errors": [],
        },
        comparison=None,
        usage=USAGE,
    )
    study_plan = [
        {
            "idx": i,
            "focus": "c1",
            "title": f"sesion {i}",
            "format": "guided",
            "estMin": 10,
            "brief": "n/a",
        }
        for i in range(1, 5)
    ]
    with pytest.raises(ValidationError):
        InterviewFeedback(**feedback_kwargs, studyPlan=study_plan)
