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
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interviews_offer_check CHECK (offer_text IS NOT NULL OR offer_url IS NOT NULL),
  CONSTRAINT interviews_answered_count_check CHECK (answered_count >= 0),
  -- Destino de la FK compuesta de study_cycles (ciclo y entrevista del mismo usuario).
  CONSTRAINT interviews_id_user_key UNIQUE (id, user_id)
);

CREATE INDEX interviews_user_created_idx ON public.interviews (user_id, created_at DESC);
CREATE INDEX interviews_parent_idx ON public.interviews (parent_interview_id);

-- Reutiliza public.set_updated_at(), creada en la migración 1.
CREATE TRIGGER interviews_set_updated_at
  BEFORE UPDATE ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
  interview_id uuid NOT NULL,
  status       text NOT NULL CHECK (status IN ('active', 'completed', 'skipped')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- Un ciclo por entrevista; el índice del UNIQUE cubre también la FK.
  CONSTRAINT study_cycles_interview_key UNIQUE (interview_id),
  -- Compuesta: el ciclo no puede colgar de la entrevista de otro usuario.
  CONSTRAINT study_cycles_interview_fkey FOREIGN KEY (interview_id, user_id)
    REFERENCES public.interviews (id, user_id) ON DELETE CASCADE
);

CREATE INDEX study_cycles_user_idx ON public.study_cycles (user_id);

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
  est_min  smallint NOT NULL CHECK (est_min > 0),
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

-- Coherencia con kind, como group_session_id/news_item_id. Las columnas son
-- nuevas (null en todas las filas), así que ninguna fila existente las viola.
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_interview_kind_check
  CHECK (kind = 'interview' OR interview_id IS NULL);

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_study_cycle_session_kind_check
  CHECK (kind = 'study' OR study_cycle_session_id IS NULL);

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
-- 7. RLS y permisos: SOLO la API accede (cliente admin), igual que `xp_events`
--    y las tablas de la sala grupal. Sin GRANT a anon/authenticated.
--    FR-7: `interviews.plan` lleva las preguntas e `interview_questions_asked`
--    las preguntas ya hechas; un GRANT SELECT a `authenticated` dejaría que el
--    usuario las leyera por la API de base de datos antes de la entrevista.
--    La app móvil solo habla con la API Nest (InsForge solo para auth), así que
--    no hace falta exponer ninguna de las 4 tablas. La RLS y las políticas de
--    dueño quedan como defensa en profundidad por si algún día se concede un
--    GRANT; en ese caso, por columnas y sin `plan`/`feedback`, y nunca sobre
--    `interview_questions_asked`. `study_cycle_sessions` no tiene `user_id`
--    propio: su política se autoriza por el `user_id` del ciclo.
-- ---------------------------------------------------------------------------
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.interviews FROM anon, authenticated;
CREATE POLICY interviews_select_own ON public.interviews
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

ALTER TABLE public.interview_questions_asked ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.interview_questions_asked FROM anon, authenticated;
CREATE POLICY interview_questions_asked_select_own ON public.interview_questions_asked
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

ALTER TABLE public.study_cycles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.study_cycles FROM anon, authenticated;
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
CREATE POLICY study_cycle_sessions_select_own ON public.study_cycle_sessions
  FOR SELECT TO authenticated
  USING (public.owns_study_cycle(cycle_id));
