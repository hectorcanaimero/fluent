"""Contrato I1 (docs/arch/003-simulador-entrevistas.md) de /v1/prepare y /v1/feedback."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator

SeniorityLevel = Literal["junior", "semi_senior", "senior", "staff_lead"]
Locale = Literal["es", "pt-BR"]


class Usage(BaseModel):
    model: str
    inputTokens: int
    outputTokens: int
    searchCalls: int


# --- /v1/prepare -------------------------------------------------------


class PrepareRequest(BaseModel):
    interviewId: str
    type: Literal["technical", "mixed"]
    offerText: str | None = None
    offerUrl: str | None = None
    learnerLevel: Literal["A2", "B1", "B2"]
    previousQuestions: list[str] = Field(default_factory=list)
    # Re-entrevista: la rúbrica de la entrevista padre, para comparar lo mismo (F13.1.T2).
    fixedRubric: list["RubricItem"] | None = None


class Company(BaseModel):
    name: str
    industry: str | None = None
    city: str | None = None
    workMode: str | None = None


class Research(BaseModel):
    found: bool
    notes: str


class RubricItem(BaseModel):
    id: str
    name: str
    expectedLevel: SeniorityLevel
    weight: float


class Question(BaseModel):
    idx: int
    competencyId: str
    kind: Literal["technical", "behavioral"]
    text: str


class PrepareOkResponse(BaseModel):
    status: Literal["ok"] = "ok"
    type: Literal["technical", "mixed"]  # eco del request
    research: Research
    company: Company
    role: str
    area: str
    seniority: SeniorityLevel
    stack: list[str]
    rubric: list[RubricItem]
    questions: list[Question]
    usage: Usage

    @model_validator(mode="after")
    def _check_invariants(self) -> "PrepareOkResponse":
        if not 4 <= len(self.rubric) <= 6:
            raise ValueError("rubric must have between 4 and 6 competencies")
        if len(self.questions) != 8:
            raise ValueError("questions must have exactly 8 items")
        if sorted(q.idx for q in self.questions) != list(range(1, 9)):
            raise ValueError("question idx values must be exactly 1..8")
        competency_ids = {item.id for item in self.rubric}
        covered = {question.competencyId for question in self.questions}
        if not covered <= competency_ids:
            raise ValueError("every question.competencyId must exist in the rubric")
        if not competency_ids <= covered:
            raise ValueError("every competency must have at least one question")

        if self.type == "mixed":
            behavioral_count = sum(1 for q in self.questions if q.kind == "behavioral")
            if behavioral_count != 2:
                raise ValueError("mixed interviews must have exactly 2 behavioral questions")
        return self


class PrepareUnreadableResponse(BaseModel):
    status: Literal["offer_unreadable"] = "offer_unreadable"
    reason: Literal["linkedin", "login", "not_found", "empty"]


PrepareResponse = PrepareOkResponse | PrepareUnreadableResponse


# --- /v1/feedback -------------------------------------------------------


class InterviewPlan(BaseModel):
    rubric: list[RubricItem]
    questions: list[Question]


class TranscriptLine(BaseModel):
    role: Literal["interviewer", "candidate"]
    questionIdx: int
    text: str


class EnglishError(BaseModel):
    original: str
    corrected: str
    category: str


Rating = Literal["very_good", "good", "fair", "needs_work"]


class RatingNote(BaseModel):
    rating: Rating
    note: str


class EnglishErrorExplained(BaseModel):
    original: str
    corrected: str
    explanation: str


class EnglishFeedback(BaseModel):
    clarity: RatingNote
    vocabulary: RatingNote
    errors: list[EnglishErrorExplained]


class CompetencyFeedback(BaseModel):
    competencyId: str
    name: str | None = None  # nombre de la rúbrica; compare() no cruza competencias distintas
    observedLevel: SeniorityLevel
    expectedLevel: SeniorityLevel
    evidence: str
    missing: str
    study: str
    verified: bool


class ComparisonItem(BaseModel):
    competencyId: str
    before: SeniorityLevel
    after: SeniorityLevel
    trend: Literal["up", "same", "down"]


class StudyPlanItem(BaseModel):
    idx: int
    focus: str
    title: str
    format: Literal["guided", "roleplay"]
    estMin: int
    brief: str


class InterviewFeedback(BaseModel):
    summary: str
    competencies: list[CompetencyFeedback]
    english: EnglishFeedback
    comparison: list[ComparisonItem] | None = None
    studyPlan: list[StudyPlanItem]
    usage: Usage

    @model_validator(mode="after")
    def _check_invariants(self) -> "InterviewFeedback":
        if len(self.studyPlan) != 5:
            raise ValueError("studyPlan must have exactly 5 items")
        return self


FeedbackResponse = InterviewFeedback


class FeedbackRequest(BaseModel):
    interviewId: str
    locale: Locale
    learnerName: str
    plan: InterviewPlan
    transcript: list[TranscriptLine]
    englishErrors: list[EnglishError] = Field(default_factory=list)
    previousFeedback: InterviewFeedback | None = None
