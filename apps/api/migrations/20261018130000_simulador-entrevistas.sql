-- F10.1.T1 · esquema del simulador de entrevistas.
-- Cubre: docs/arch/003-simulador-entrevistas.md §Data model,
--        specs/f10-entrevistas-preparacion.md#F10.1.T1.
--
-- Las 4 tablas nuevas van antes de los ALTER a `sessions`/`llm_calls`: ambas
-- referencian `interviews` o `study_cycle_sessions`, que todavía no existen
-- al principio de esta migración (al revés que en el bloque de la arquitectura).

-- ---------------------------------------------------------------------------
-- 1. interviews
-- ---------------------------------------------------------------------------
CREATE TABLE public.interviews (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_interview_id uuid REFERENCES public.interviews(id) ON DELETE SET NULL, -- re-entrevista
  type                text NOT NULL CHECK (type IN ('technical', 'mixed')),
  offer_text          text CHECK (char_length(offer_text) <= 20000),
  offer_url           text,
  offer_hash          text NOT NULL,          -- sha256 del texto normalizado o de la URL
  status              text NOT NULL CHECK (status IN (
                        'preparing', 'prep_failed', 'ready', 'in_progress', 'too_short',
                        'feedback_pending', 'feedback_ready', 'feedback_failed')),
  prep_step           text CHECK (prep_step IN ('reading', 'researching', 'designing', 'done')),
  company             jsonb,                 -- {name, industry?, city?, workMode?}
  role                text,
  area                text,
  seniority           text,
  plan                jsonb,                 -- InterviewPlan (sin exponer preguntas a la app)
  feedback            jsonb,                 -- InterviewFeedback
  error_code          text,
  answered_count      int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX interviews_user_created_idx ON public.interviews (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. interview_questions_asked · últimas preguntas por oferta/área, para no
--    repetirlas en una re-entrevista (FR-20, I1 `previousQuestions`).
-- ---------------------------------------------------------------------------
CREATE TABLE public.interview_questions_asked (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_hash text NOT NULL,
  area       text NOT NULL,
  question   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX interview_questions_user_idx ON public.interview_questions_asked (user_id, offer_hash);

-- ---------------------------------------------------------------------------
-- 3. study_cycles · el ciclo de 5 sesiones armado desde el `studyPlan` del
--    parecer (FR-17).
-- ---------------------------------------------------------------------------
CREATE TABLE public.study_cycles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  status       text NOT NULL CHECK (status IN ('active', 'completed', 'skipped')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 4. study_cycle_sessions · las 5 sesiones del ciclo, una por `idx`.
-- ---------------------------------------------------------------------------
CREATE TABLE public.study_cycle_sessions (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.study_cycles(id) ON DELETE CASCADE,
  idx      smallint NOT NULL CHECK (idx BETWEEN 1 AND 5),
  focus    text NOT NULL,          -- competencia o 'english'
  title    text NOT NULL,
  format   text NOT NULL CHECK (format IN ('guided', 'roleplay')),
  est_min  smallint NOT NULL,
  brief    text NOT NULL,          -- qué practicar, para el prompt
  done_at  timestamptz,
  UNIQUE (cycle_id, idx)
);

-- ---------------------------------------------------------------------------
-- 5. sessions · kinds `interview`/`study` y el vínculo con la entrevista o la
--    sesión del ciclo que abrió esa sesión (D3: los turnos reusan el pipeline
--    de `sessions` en vez de uno propio del módulo `interviews`).
-- ---------------------------------------------------------------------------
ALTER TABLE public.sessions
  DROP CONSTRAINT sessions_kind_check;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_kind_check
  CHECK (kind IN ('free_topic', 'roleplay', 'news', 'boss', 'group', 'interview', 'study'));

ALTER TABLE public.sessions
  ADD COLUMN interview_id uuid REFERENCES public.interviews(id) ON DELETE SET NULL;

ALTER TABLE public.sessions
  ADD COLUMN study_cycle_session_id uuid REFERENCES public.study_cycle_sessions(id) ON DELETE SET NULL;

ALTER TABLE public.sessions
  ADD COLUMN active_sec int NOT NULL DEFAULT 0; -- D4: tiempo activo acumulado, no reloj de pared

CREATE INDEX sessions_interview_idx ON public.sessions (interview_id);
CREATE INDEX sessions_study_cycle_session_idx ON public.sessions (study_cycle_session_id);

-- ---------------------------------------------------------------------------
-- 6. llm_calls.purpose · preparación y parecer de entrevistas, además de los
--    propósitos existentes (`turn`, `brief`, `weekly`).
-- ---------------------------------------------------------------------------
ALTER TABLE public.llm_calls
  DROP CONSTRAINT llm_calls_purpose_check;

ALTER TABLE public.llm_calls
  ADD CONSTRAINT llm_calls_purpose_check
  CHECK (purpose IN ('turn', 'brief', 'weekly', 'interview', 'interview_prepare', 'interview_feedback'));

-- ---------------------------------------------------------------------------
-- 7. RLS: el dueño lee sus filas; escribe solo la API con el cliente admin,
--    igual que `sessions` (SPEC-01 §3). `study_cycle_sessions` no tiene
--    `user_id` propio: se autoriza por el `user_id` del ciclo al que pertenece.
-- ---------------------------------------------------------------------------
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.interviews FROM anon, authenticated;
GRANT SELECT ON public.interviews TO authenticated;
CREATE POLICY interviews_select_own ON public.interviews
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

ALTER TABLE public.interview_questions_asked ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.interview_questions_asked FROM anon, authenticated;
GRANT SELECT ON public.interview_questions_asked TO authenticated;
CREATE POLICY interview_questions_asked_select_own ON public.interview_questions_asked
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

ALTER TABLE public.study_cycles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.study_cycles FROM anon, authenticated;
GRANT SELECT ON public.study_cycles TO authenticated;
CREATE POLICY study_cycles_select_own ON public.study_cycles
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Helper para study_cycle_sessions: evita que su política reentre en la RLS
-- de study_cycles (mismo patrón que public.owns_session para `turns`).
CREATE OR REPLACE FUNCTION public.owns_study_cycle(p_cycle_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.study_cycles c
    WHERE c.id = p_cycle_id AND c.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.owns_study_cycle(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owns_study_cycle(uuid) TO authenticated;

ALTER TABLE public.study_cycle_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.study_cycle_sessions FROM anon, authenticated;
GRANT SELECT ON public.study_cycle_sessions TO authenticated;
CREATE POLICY study_cycle_sessions_select_own ON public.study_cycle_sessions
  FOR SELECT TO authenticated
  USING (public.owns_study_cycle(cycle_id));
