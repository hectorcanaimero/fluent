import {
  InterviewFeedback,
  InterviewPlan,
  PrepareRequest,
  PrepareResponse,
  type StudyPlanItem,
} from './interviews.types.js';

/** Plan válido: `mixed`, 5 competencias, 8 preguntas, exactamente 2 behavioral. */
function validPlan() {
  return {
    type: 'mixed' as const,
    company: { name: 'Acme' },
    role: 'Backend engineer',
    area: 'engineering',
    seniority: 'semi_senior' as const,
    stack: ['node', 'postgres'],
    rubric: [
      { id: 'c1', name: 'APIs', expectedLevel: 'semi_senior' as const, weight: 1 },
      { id: 'c2', name: 'Testing', expectedLevel: 'semi_senior' as const, weight: 1 },
      { id: 'c3', name: 'Databases', expectedLevel: 'semi_senior' as const, weight: 1 },
      { id: 'c4', name: 'Communication', expectedLevel: 'semi_senior' as const, weight: 1 },
      { id: 'c5', name: 'System design', expectedLevel: 'semi_senior' as const, weight: 1 },
    ],
    questions: [
      { idx: 1, competencyId: 'c1', kind: 'technical' as const, text: 'q1' },
      { idx: 2, competencyId: 'c2', kind: 'technical' as const, text: 'q2' },
      { idx: 3, competencyId: 'c3', kind: 'technical' as const, text: 'q3' },
      { idx: 4, competencyId: 'c4', kind: 'technical' as const, text: 'q4' },
      { idx: 5, competencyId: 'c5', kind: 'technical' as const, text: 'q5' },
      { idx: 6, competencyId: 'c1', kind: 'behavioral' as const, text: 'q6' },
      { idx: 7, competencyId: 'c3', kind: 'behavioral' as const, text: 'q7' },
      { idx: 8, competencyId: 'c5', kind: 'technical' as const, text: 'q8' },
    ],
  };
}

function validStudyPlanItem(idx: number): StudyPlanItem {
  return {
    idx,
    focus: idx % 2 === 0 ? 'english' : 'c1',
    title: `Práctica ${idx}`,
    format: 'guided',
    estMin: 10,
    brief: 'brief',
  };
}

function validFeedback() {
  return {
    summary: 'Buen desempeño general.',
    competencies: [],
    english: {
      clarity: { rating: 'good' as const, note: 'ok' },
      vocabulary: { rating: 'good' as const, note: 'ok' },
      errors: [],
    },
    comparison: null,
    studyPlan: [1, 2, 3, 4, 5].map(validStudyPlanItem),
    usage: { model: 'fluent-pro', inputTokens: 1, outputTokens: 1, searchCalls: 0 },
  };
}

describe('InterviewPlan', () => {
  it('acepta un plan válido', () => {
    expect(InterviewPlan.safeParse(validPlan()).success).toBe(true);
  });

  it('rechaza un plan con 7 preguntas', () => {
    const plan = validPlan();
    plan.questions = plan.questions.slice(0, 7);
    expect(InterviewPlan.safeParse(plan).success).toBe(false);
  });

  it('rechaza un plan mixed con 1 pregunta behavioral', () => {
    const plan = validPlan();
    plan.questions[6] = { ...plan.questions[6], kind: 'technical' as const };
    expect(InterviewPlan.safeParse(plan).success).toBe(false);
  });

  it('acepta un plan technical con preguntas behavioral (I1 solo fija mixed)', () => {
    const plan = { ...validPlan(), type: 'technical' as const };
    expect(InterviewPlan.safeParse(plan).success).toBe(true);
  });

  it('rechaza ids de competencia repetidos', () => {
    const plan = validPlan();
    plan.rubric[4] = { ...plan.rubric[4], id: 'c1' };
    expect(InterviewPlan.safeParse(plan).success).toBe(false);
  });

  it('rechaza una pregunta con competencyId fuera de la rúbrica', () => {
    const plan = validPlan();
    plan.questions[7] = { ...plan.questions[7], competencyId: 'c9' };
    expect(InterviewPlan.safeParse(plan).success).toBe(false);
  });

  it('rechaza idx repetidos aunque haya 8 preguntas', () => {
    const plan = validPlan();
    plan.questions[7] = { ...plan.questions[7], idx: 1 };
    expect(InterviewPlan.safeParse(plan).success).toBe(false);
  });

  it('rechaza un peso de competencia no positivo', () => {
    const plan = validPlan();
    plan.rubric[0] = { ...plan.rubric[0], weight: 0 };
    expect(InterviewPlan.safeParse(plan).success).toBe(false);
  });
});

describe('PrepareResponse', () => {
  const ok = () => ({
    ...validPlan(),
    status: 'ok' as const,
    research: { found: true, notes: '' },
    usage: {
      model: 'fluent-pro',
      inputTokens: 1,
      outputTokens: 1,
      searchCalls: 1,
    },
  });

  it('acepta ok con type', () => {
    expect(PrepareResponse.safeParse(ok()).success).toBe(true);
  });

  it('rechaza ok sin type', () => {
    const { type: _omit, ...response } = ok();
    expect(PrepareResponse.safeParse(response).success).toBe(false);
  });

  it('valida la regla mixed contra el type devuelto', () => {
    const response = ok();
    response.questions[6] = {
      ...response.questions[6],
      kind: 'technical' as const,
    };
    expect(PrepareResponse.safeParse(response).success).toBe(false);
    expect(
      PrepareResponse.safeParse({ ...response, type: 'technical' }).success,
    ).toBe(true);
  });
});

describe('PrepareRequest', () => {
  const request = (offerText: string | null, offerUrl: string | null) => ({
    interviewId: '9595625c-aea8-4120-accc-ed149d0a84c6',
    type: 'mixed',
    offerText,
    offerUrl,
    learnerLevel: 'B1',
    previousQuestions: [],
  });

  it('acepta solo offerText o solo offerUrl', () => {
    expect(PrepareRequest.safeParse(request('oferta', null)).success).toBe(
      true,
    );
    expect(
      PrepareRequest.safeParse(request(null, 'https://acme.test/job')).success,
    ).toBe(true);
  });

  it('rechaza sin offerText ni offerUrl', () => {
    expect(PrepareRequest.safeParse(request(null, null)).success).toBe(false);
  });
});

describe('InterviewFeedback', () => {
  it('acepta un parecer con studyPlan de 5', () => {
    expect(InterviewFeedback.safeParse(validFeedback()).success).toBe(true);
  });

  it('rechaza un parecer con studyPlan de 4', () => {
    const feedback = validFeedback();
    feedback.studyPlan = feedback.studyPlan.slice(0, 4);
    expect(InterviewFeedback.safeParse(feedback).success).toBe(false);
  });

  it('rechaza studyPlan con idx repetidos', () => {
    const feedback = validFeedback();
    feedback.studyPlan[4] = validStudyPlanItem(1);
    expect(InterviewFeedback.safeParse(feedback).success).toBe(false);
  });
});
