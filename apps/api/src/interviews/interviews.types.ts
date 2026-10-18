import { z } from 'zod';

/**
 * Contratos del simulador de entrevistas (docs/arch/003-simulador-entrevistas.md,
 * Interfaces I1 e I2). I1 es el contrato HTTP con `interview-agent` (C1): los
 * mismos schemas zod validan la respuesta que llega de Python, así que no se
 * duplica el invariante en los dos lenguajes.
 */

/* ============================================================================
   Enums (CHECKs de `interviews` / `study_cycle_sessions`, migración F10.1.T1)
   ========================================================================== */

export const INTERVIEW_TYPES = ['technical', 'mixed'] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];

export const INTERVIEW_STATUSES = [
  'preparing',
  'prep_failed',
  'ready',
  'in_progress',
  'too_short',
  'feedback_pending',
  'feedback_ready',
  'feedback_failed',
] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export const PREP_STEPS = ['reading', 'researching', 'designing', 'done'] as const;
export type PrepStep = (typeof PREP_STEPS)[number];

export const SENIORITY_LEVELS = ['junior', 'semi_senior', 'senior', 'staff_lead'] as const;
export type SeniorityLevel = (typeof SENIORITY_LEVELS)[number];

const InterviewTypeSchema = z.enum(INTERVIEW_TYPES);
const SeniorityLevelSchema = z.enum(SENIORITY_LEVELS);
const LearnerLevelSchema = z.enum(['A2', 'B1', 'B2']);
const LocaleSchema = z.enum(['es', 'pt-BR']);

/* ============================================================================
   I1 — C2/C3 → C1 (interview-agent): POST /v1/prepare
   ========================================================================== */

const Company = z.object({
  name: z.string().min(1),
  industry: z.string().optional(),
  city: z.string().optional(),
  workMode: z.string().optional(),
});

const Competency = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  expectedLevel: SeniorityLevelSchema,
  weight: z.number(),
});

const QuestionKindSchema = z.enum(['technical', 'behavioral']);

const Question = z.object({
  idx: z.number().int().min(1).max(8),
  competencyId: z.string().min(1),
  kind: QuestionKindSchema,
  text: z.string().min(1),
});

const Usage = z.object({
  model: z.string().min(1),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  searchCalls: z.number().int().min(0),
});

/** Sin invariantes todavía: la reutilizan `InterviewPlan` y la variante `ok` de `PrepareResponse`. */
const InterviewPlanShape = z.object({
  type: InterviewTypeSchema,
  company: Company,
  role: z.string().min(1),
  area: z.string().min(1),
  seniority: SeniorityLevelSchema,
  stack: z.array(z.string()),
  rubric: z.array(Competency),
  questions: z.array(Question),
});

/**
 * Invariantes de I1: 4–6 competencias, exactamente 8 preguntas, cada
 * competencia con al menos una pregunta, y el número de preguntas
 * `behavioral` fijado por `type` (2 en `mixed`, 0 en `technical`).
 */
function checkPlanInvariants(
  plan: z.infer<typeof InterviewPlanShape>,
  ctx: z.RefinementCtx,
): void {
  if (plan.rubric.length < 4 || plan.rubric.length > 6) {
    ctx.addIssue({
      code: 'custom',
      message: 'rubric debe tener entre 4 y 6 competencias.',
      path: ['rubric'],
    });
  }

  if (plan.questions.length !== 8) {
    ctx.addIssue({
      code: 'custom',
      message: 'questions debe tener exactamente 8 preguntas.',
      path: ['questions'],
    });
  }

  for (const competency of plan.rubric) {
    if (!plan.questions.some((question) => question.competencyId === competency.id)) {
      ctx.addIssue({
        code: 'custom',
        message: `la competencia ${competency.id} no tiene ninguna pregunta.`,
        path: ['rubric'],
      });
    }
  }

  const behavioralCount = plan.questions.filter((question) => question.kind === 'behavioral').length;
  const expectedBehavioral = plan.type === 'mixed' ? 2 : 0;
  if (behavioralCount !== expectedBehavioral) {
    ctx.addIssue({
      code: 'custom',
      message: `type=${plan.type} debe tener ${expectedBehavioral} preguntas behavioral, no ${behavioralCount}.`,
      path: ['questions'],
    });
  }
}

/** `rubric` + `questions` que devuelve `/v1/prepare` y que se reenvía a `/v1/feedback`. */
export const InterviewPlan = InterviewPlanShape.superRefine(checkPlanInvariants);
export type InterviewPlan = z.infer<typeof InterviewPlanShape>;

export const PrepareRequest = z.object({
  interviewId: z.uuid(),
  type: InterviewTypeSchema,
  offerText: z.string().max(20000).nullable(),
  offerUrl: z.url().nullable(),
  learnerLevel: LearnerLevelSchema,
  previousQuestions: z.array(z.string()),
});
export type PrepareRequest = z.infer<typeof PrepareRequest>;

const Research = z.object({
  found: z.boolean(),
  notes: z.string(),
});

export const OFFER_UNREADABLE_REASONS = ['linkedin', 'login', 'not_found', 'empty'] as const;
export type OfferUnreadableReason = (typeof OFFER_UNREADABLE_REASONS)[number];

const PrepareResponseOk = InterviewPlanShape.extend({
  status: z.literal('ok'),
  research: Research,
  usage: Usage,
});

const PrepareResponseOfferUnreadable = z.object({
  status: z.literal('offer_unreadable'),
  reason: z.enum(OFFER_UNREADABLE_REASONS),
});

/** Incluye la variante `offer_unreadable` (oferta de LinkedIn, vacía, 4xx o pared de login). */
export const PrepareResponse = z
  .discriminatedUnion('status', [PrepareResponseOk, PrepareResponseOfferUnreadable])
  .superRefine((value, ctx) => {
    if (value.status === 'ok') checkPlanInvariants(value, ctx);
  });
export type PrepareResponse = z.infer<typeof PrepareResponse>;

/* ============================================================================
   I1 — POST /v1/feedback
   ========================================================================== */

const TranscriptLine = z.object({
  role: z.enum(['interviewer', 'candidate']),
  questionIdx: z.number().int().min(1).max(8),
  text: z.string(),
});

const EnglishErrorIn = z.object({
  original: z.string(),
  corrected: z.string(),
  category: z.string(),
});

const RATINGS = ['very_good', 'good', 'fair', 'needs_work'] as const;

const EnglishAspect = z.object({
  rating: z.enum(RATINGS),
  note: z.string(),
});

const EnglishErrorOut = z.object({
  original: z.string(),
  corrected: z.string(),
  explanation: z.string(),
});

const EnglishFeedback = z.object({
  clarity: EnglishAspect,
  vocabulary: EnglishAspect,
  errors: z.array(EnglishErrorOut),
});

const CompetencyFeedback = z.object({
  competencyId: z.string().min(1),
  observedLevel: SeniorityLevelSchema,
  expectedLevel: SeniorityLevelSchema,
  evidence: z.string(),
  missing: z.string(),
  study: z.string(),
  verified: z.boolean(),
});

const TRENDS = ['up', 'same', 'down'] as const;

const ComparisonItem = z.object({
  competencyId: z.string().min(1),
  before: SeniorityLevelSchema,
  after: SeniorityLevelSchema,
  trend: z.enum(TRENDS),
});

export const StudyPlanItem = z.object({
  idx: z.number().int().min(1).max(5),
  focus: z.string().min(1),
  title: z.string().min(1),
  format: z.enum(['guided', 'roleplay']),
  estMin: z.number().int().positive(),
  brief: z.string().min(1),
});
export type StudyPlanItem = z.infer<typeof StudyPlanItem>;

const InterviewFeedbackShape = z.object({
  summary: z.string().min(1),
  competencies: z.array(CompetencyFeedback),
  english: EnglishFeedback,
  comparison: z.array(ComparisonItem).nullable(),
  studyPlan: z.array(StudyPlanItem),
  usage: Usage,
});

/** Invariante de I1: `studyPlan` tiene exactamente 5 items. */
export const InterviewFeedback = InterviewFeedbackShape.superRefine((value, ctx) => {
  if (value.studyPlan.length !== 5) {
    ctx.addIssue({
      code: 'custom',
      message: 'studyPlan debe tener exactamente 5 items.',
      path: ['studyPlan'],
    });
  }
});
export type InterviewFeedback = z.infer<typeof InterviewFeedbackShape>;

export const FeedbackRequest = z.object({
  interviewId: z.uuid(),
  locale: LocaleSchema,
  learnerName: z.string().min(1),
  plan: InterviewPlan,
  transcript: z.array(TranscriptLine),
  englishErrors: z.array(EnglishErrorIn),
  previousFeedback: InterviewFeedback.nullable(),
});
export type FeedbackRequest = z.infer<typeof FeedbackRequest>;

/** El body de `/v1/feedback` es exactamente un `InterviewFeedback`. */
export const FeedbackResponse = InterviewFeedback;
export type FeedbackResponse = InterviewFeedback;
