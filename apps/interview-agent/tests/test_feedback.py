import pytest
from fastapi.testclient import TestClient

from app.contract import FeedbackRequest, InterviewFeedback
from app.feedback import evaluator
from app.feedback.evaluator import FeedbackDraft, find_forbidden, likely_stt_error
from tests.conftest import TEST_TOKEN

AUTH = {"Authorization": f"Bearer {TEST_TOKEN}"}
ANSWERS = {
    1: "I would put a cash in front of the database to reduce latency.",
    2: "We use indexes on the columns we filter by.",
    3: "I write unit tests with pytest for every service.",
    4: "When a deploy failed I talked with the team and we fixed it.",
}

REQUEST = {
    "interviewId": "i-1",
    "locale": "es",
    "learnerName": "María",
    "plan": {
        "rubric": [
            {"id": f"c{i}", "name": f"comp {i}", "expectedLevel": "semi_senior", "weight": 1}
            for i in range(1, 5)
        ],
        "questions": [
            {"idx": i, "competencyId": f"c{(i - 1) % 4 + 1}", "kind": "technical", "text": f"Q{i}?"}
            for i in range(1, 9)
        ],
    },
    "transcript": [
        line
        for idx, answer in ANSWERS.items()
        for line in (
            {"role": "interviewer", "questionIdx": idx, "text": f"Q{idx}?"},
            {"role": "candidate", "questionIdx": idx, "text": answer},
        )
    ],
    "englishErrors": [{"original": "a cash", "corrected": "a cache", "category": "vocabulary"}],
}

EVIDENCE = {
    "c1": "put a cash in front of the database",
    "c2": "We use indexes",
    "c3": "unit tests with pytest",
    "c4": "I talked with the team",
}


def _draft(
    evidence: dict[str, str] | None = None,
    levels: dict[str, str] | None = None,
    focuses: list[str] | None = None,
    summary: str = "María, explicaste bien tus pruebas. Tu foco es el diseño de datos.",
    errors: list[dict] | None = None,
) -> FeedbackDraft:
    evidence = {**EVIDENCE, **(evidence or {})}
    levels = levels or {}
    return FeedbackDraft.model_validate(
        {
            "summary": summary,
            "competencies": [
                {
                    "competencyId": cid,
                    "observedLevel": levels.get(cid, "semi_senior"),
                    "expectedLevel": "senior",  # se corrige con la rúbrica
                    "evidence": quote,
                    "missing": "Faltó profundidad.",
                    "study": "Estudia el tema.",
                    "verified": cid == "c1",
                }
                for cid, quote in evidence.items()
            ],
            "english": {
                "clarity": {"rating": "good", "note": "Se entiende bien."},
                "vocabulary": {"rating": "fair", "note": "Vocabulario básico."},
                "errors": errors
                if errors is not None
                else [
                    {"original": "a cash", "corrected": "a cache", "explanation": "x"},
                    {"original": "he go", "corrected": "he goes", "explanation": "tercera persona"},
                ],
            },
            "studyPlan": [
                {
                    "idx": i,
                    "focus": focus,
                    "title": f"Sesión {i}",
                    "format": "guided",
                    "estMin": 15,
                    "brief": "Practica.",
                }
                for i, focus in enumerate(focuses or ["c1", "c2", "english", "c3", "c4"], 1)
            ],
        }
    )


def _fake_agent(
    monkeypatch: pytest.MonkeyPatch, drafts: list[FeedbackDraft], searches: int = 1
) -> list[str]:
    prompts: list[str] = []

    async def fake(req: FeedbackRequest, prompt: str) -> tuple[FeedbackDraft, int, int, int]:
        prompts.append(prompt)
        return drafts[min(len(prompts), len(drafts)) - 1], 1000, 500, searches

    monkeypatch.setattr(evaluator, "run_feedback_agent", fake)
    return prompts


def _post(client: TestClient, body: dict) -> dict:
    resp = client.post("/v1/feedback", json=body, headers=AUTH)
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_parecer_valido(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    prompts = _fake_agent(monkeypatch, [_draft()])
    body = _post(client, REQUEST)
    assert len(prompts) == 1
    assert len(body["studyPlan"]) == 5
    assert [s["idx"] for s in body["studyPlan"]] == [1, 2, 3, 4, 5]
    assert body["comparison"] is None
    assert {c["expectedLevel"] for c in body["competencies"]} == {"semi_senior"}
    assert body["usage"] == {
        "model": "fluent-pro",
        "inputTokens": 1000,
        "outputTokens": 500,
        "searchCalls": 1,
    }
    assert "<untrusted_transcript>" in prompts[0]


def test_evidencia_inventada_reintenta_y_luego_se_quita(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    fake = _draft(evidence={"c2": "I designed a sharding strategy"})
    prompts = _fake_agent(monkeypatch, [fake, fake])
    body = _post(client, REQUEST)
    assert len(prompts) == 2
    assert "c2" in prompts[1] and "literal substring" in prompts[1]
    assert [c["competencyId"] for c in body["competencies"]] == ["c1", "c3", "c4"]


def test_evidencia_corregida_en_el_reintento(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    prompts = _fake_agent(
        monkeypatch,
        [_draft(evidence={"c2": "we always shard"}), _draft(evidence={"c2": '"We use indexes"'})],
    )
    body = _post(client, REQUEST)
    assert len(prompts) == 2
    c2 = next(c for c in body["competencies"] if c["competencyId"] == "c2")
    assert c2["evidence"] == "We use indexes"


def test_cash_en_contexto_de_cache_no_es_error(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _fake_agent(monkeypatch, [_draft()])
    body = _post(client, REQUEST)
    errors = body["english"]["errors"]
    assert all("cash" not in e["original"] for e in errors)
    assert [e["original"] for e in errors] == ["he go"]


@pytest.mark.parametrize(
    ("original", "corrected", "stt"),
    [
        ("a cash", "a cache", True),
        ("put it there house", "put it their house", True),
        ("he go", "he goes", False),
        ("many advices", "much advice", False),
        ("I am agree", "I agree", False),
        ("depend of", "depend on", False),
    ],
)
def test_likely_stt_error(original: str, corrected: str, stt: bool) -> None:
    assert likely_stt_error(original, corrected) is stt


@pytest.mark.parametrize(
    "text",
    [
        "María, con estas respuestas you would be hired.",
        "María, tu perfil sería rechazado.",
        "María, você seria contratada.",
        "Maria, você foi reprovada.",
        "You'd be rejected in a real interview.",
        "Con esto pasaste la entrevista.",
    ],
)
def test_expresiones_prohibidas(text: str) -> None:
    assert find_forbidden(_draft(summary=text))


def test_tono_neutral_no_dispara() -> None:
    assert find_forbidden(_draft()) == []


def test_parecer_con_veredicto_se_rechaza(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    verdict = _draft(summary="María, you would be hired. Muy bien.")
    prompts = _fake_agent(monkeypatch, [verdict, _draft(summary="María, fuiste rechazado.")])
    resp = client.post("/v1/feedback", json=REQUEST, headers=AUTH)
    assert resp.status_code == 502
    assert len(prompts) == 2
    assert "verdict" in prompts[1]


def test_veredicto_corregido_en_el_reintento(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    prompts = _fake_agent(monkeypatch, [_draft(summary="Rechazado."), _draft()])
    body = _post(client, REQUEST)
    assert len(prompts) == 2
    assert body["summary"].startswith("María")


def _previous() -> dict:
    previous = _draft(levels={"c1": "junior", "c2": "senior"})
    return InterviewFeedback(
        **previous.model_dump(),
        usage={"model": "m", "inputTokens": 0, "outputTokens": 0, "searchCalls": 0},
    ).model_dump()


def test_comparison_solo_con_previous_feedback(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # c1 sube junior→semi_senior, c2 baja senior→semi_senior y está en el plan.
    prompts = _fake_agent(monkeypatch, [_draft()])
    body = _post(client, {**REQUEST, "previousFeedback": _previous()})
    trends = {c["competencyId"]: c["trend"] for c in body["comparison"]}
    assert trends == {"c1": "up", "c2": "down", "c3": "same", "c4": "same"}
    assert "<untrusted_previous_feedback>" in prompts[0]


def test_lo_que_retrocedio_entra_al_plan(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    without_c2 = _draft(focuses=["c1", "c3", "english", "c4", "english"])
    prompts = _fake_agent(monkeypatch, [without_c2, _draft()])
    body = _post(client, {**REQUEST, "previousFeedback": _previous()})
    assert len(prompts) == 2
    assert "c2" in prompts[1] and "regressed" in prompts[1]
    assert "c2" in {s["focus"] for s in body["studyPlan"]}


def test_study_plan_sin_ingles_o_de_4_items_se_reintenta(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    prompts = _fake_agent(
        monkeypatch,
        [
            _draft(focuses=["c1", "c2", "c3", "c4", "c1"]),
            _draft(focuses=["c1", "english", "c2", "c3"]),
        ],
    )
    resp = client.post("/v1/feedback", json=REQUEST, headers=AUTH)
    assert resp.status_code == 502
    assert len(prompts) == 2
    assert "english" in prompts[1]


def test_verified_sin_busqueda_queda_en_false(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _fake_agent(monkeypatch, [_draft()], searches=0)
    body = _post(client, REQUEST)
    assert not any(c["verified"] for c in body["competencies"])


def test_sin_token_401(client: TestClient) -> None:
    assert client.post("/v1/feedback", json=REQUEST).status_code == 401
