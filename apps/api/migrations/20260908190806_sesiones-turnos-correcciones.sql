-- SPEC-01 §6 migración 3 · sesiones, turnos, correcciones y auditoría
-- Cubre: SPEC-01 §2.6 (sessions), §2.7 (turns), §2.8 (corrections),
--        §2.13 (xp_events), §2.14 (llm_calls), §3 (RLS) y la función
--        `close_session` de §5, que implementa SPEC-07 §2.
-- Decisiones fuera de spec: docs/specs/PENDIENTES.md.

-- ---------------------------------------------------------------------------
-- 1. sessions (SPEC-01 §2.6)
--    `news_item_id` y `callback_fact_id` se declaran sin FK: `news_items` y
--    `facts` llegan en las migraciones 5 y 4. Cada una añade su FOREIGN KEY.
-- ---------------------------------------------------------------------------
CREATE TABLE public.sessions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind                   text NOT NULL CHECK (kind IN ('free_topic', 'roleplay', 'news', 'boss')),
  topic                  text NOT NULL,
  news_item_id           uuid,
  -- SPEC-07 §2 y §7: bonus de desafío cruzado. Ver PENDIENTES.
  challenge_from_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status                 text NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'ended', 'abandoned')),
  started_at             timestamptz NOT NULL DEFAULT now(),
  ended_at               timestamptz,
  duration_sec           int CHECK (duration_sec >= 0),
  turns_count            int NOT NULL DEFAULT 0 CHECK (turns_count >= 0),
  xp_earned              int NOT NULL DEFAULT 0 CHECK (xp_earned >= 0),
  chat_model_used        text,
  callback_fact_id       uuid,
  brief_job_status       text NOT NULL DEFAULT 'pending'
                           CHECK (brief_job_status IN ('pending', 'running', 'done', 'failed')),
  CHECK (kind = 'news' OR news_item_id IS NULL)
);

CREATE INDEX sessions_user_started_idx ON public.sessions (user_id, started_at DESC);
CREATE INDEX sessions_active_idx ON public.sessions (started_at) WHERE status = 'active';
CREATE INDEX sessions_news_item_idx ON public.sessions (news_item_id);
CREATE INDEX sessions_challenge_from_idx ON public.sessions (challenge_from_user_id);

-- ---------------------------------------------------------------------------
-- 2. turns (SPEC-01 §2.7)
-- ---------------------------------------------------------------------------
CREATE TABLE public.turns (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  idx        int NOT NULL CHECK (idx >= 0),
  role       text NOT NULL CHECK (role IN ('user', 'tutor')),
  text       text NOT NULL,
  model      text,
  tokens_in  int,
  tokens_out int,
  latency_ms int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, idx),
  -- model, tokens y latencia solo tienen sentido en los turnos del tutor.
  CHECK (role = 'tutor' OR (model IS NULL AND tokens_in IS NULL
                            AND tokens_out IS NULL AND latency_ms IS NULL))
);

-- ---------------------------------------------------------------------------
-- 3. corrections (SPEC-01 §2.8, catálogo de categorías de §4)
-- ---------------------------------------------------------------------------
CREATE TABLE public.corrections (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  turn_idx   int NOT NULL CHECK (turn_idx >= 0),
  original   text NOT NULL,
  corrected  text NOT NULL,
  category   text NOT NULL CHECK (category IN (
               'past_simple', 'present_perfect', 'articles', 'prepositions',
               'word_order', 'subject_verb', 'plurals', 'vocabulary',
               'pronunciation_hint', 'false_friend', 'phrasal_verb',
               'conditional', 'modal', 'other')),
  note       text CHECK (note IS NULL OR char_length(note) <= 140),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX corrections_user_category_idx
  ON public.corrections (user_id, category, created_at DESC);
CREATE INDEX corrections_session_idx ON public.corrections (session_id);

-- ---------------------------------------------------------------------------
-- 4. xp_events (SPEC-01 §2.13). `streak_7` se añade al catálogo: SPEC-07 §2
--    emite ese evento con XP_STREAK_7_BONUS. Ver PENDIENTES.
-- ---------------------------------------------------------------------------
CREATE TABLE public.xp_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  kind       text NOT NULL CHECK (kind IN ('session', 'duration_bonus', 'double_day',
                                           'boss', 'challenge', 'streak_7')),
  amount     int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX xp_events_user_created_idx ON public.xp_events (user_id, created_at DESC);
CREATE INDEX xp_events_session_idx ON public.xp_events (session_id);

-- ---------------------------------------------------------------------------
-- 5. llm_calls (SPEC-01 §2.14). Nunca guarda el contenido del prompt.
--    `prompt_version` y los estados extra los pide PR-03.
-- ---------------------------------------------------------------------------
CREATE TABLE public.llm_calls (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id     uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  purpose        text NOT NULL CHECK (purpose IN ('turn', 'brief', 'weekly')),
  provider       text,
  model          text,
  prompt_version int NOT NULL DEFAULT 1,
  tokens_in      int,
  tokens_out     int,
  latency_ms     int,
  status         text NOT NULL CHECK (status IN ('ok', 'invalid_json', 'provider_error',
                                                 'rate_limited', 'fallback', 'auth_error',
                                                 'no_credits', 'timeout')),
  attempt        int NOT NULL DEFAULT 1 CHECK (attempt >= 1),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX llm_calls_created_idx ON public.llm_calls (created_at DESC);
CREATE INDEX llm_calls_user_created_idx ON public.llm_calls (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 6. RLS y GRANTs (SPEC-01 §3): la app solo lee lo suyo; nada escribe.
-- ---------------------------------------------------------------------------

-- Helper para turns: evita que su política reentre en la RLS de sessions.
CREATE OR REPLACE FUNCTION public.owns_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = p_session_id AND s.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.owns_session(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owns_session(uuid) TO authenticated;

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sessions FROM anon, authenticated;
GRANT SELECT ON public.sessions TO authenticated;
CREATE POLICY sessions_select_own ON public.sessions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

ALTER TABLE public.turns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.turns FROM anon, authenticated;
GRANT SELECT ON public.turns TO authenticated;
CREATE POLICY turns_select_own ON public.turns
  FOR SELECT TO authenticated
  USING (public.owns_session(session_id));

ALTER TABLE public.corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.corrections FROM anon, authenticated;
GRANT SELECT ON public.corrections TO authenticated;
CREATE POLICY corrections_select_own ON public.corrections
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- xp_events y llm_calls: invisibles para la app, solo la API con rol admin.
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.xp_events FROM anon, authenticated;

ALTER TABLE public.llm_calls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.llm_calls FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. close_session (SPEC-01 §5) implementa SPEC-07 §2 al pie de la letra.
--    Las constantes son literales con el nombre de SPEC-07 §1 / SPEC-04 §1.
--    Devuelve { xp_earned, streak, is_double_day, next_is_boss }.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_session(
  p_session_id   uuid,
  p_duration_sec int,
  p_turns_count  int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  -- SPEC-07 §1
  c_xp_session_base       constant int := 50;   -- XP_SESSION_BASE
  c_xp_per_minute_after_5 constant int := 6;    -- XP_PER_MINUTE_AFTER_5
  c_xp_duration_cap       constant int := 30;   -- tope de los minutos 6 a 10
  c_xp_double_day_bonus   constant int := 25;   -- XP_DOUBLE_DAY_BONUS
  c_xp_boss_multiplier    constant int := 2;    -- XP_BOSS_MULTIPLIER
  c_xp_challenge_bonus    constant int := 15;   -- XP_CHALLENGE_BONUS
  c_xp_streak_7_bonus     constant int := 40;   -- XP_STREAK_7_BONUS
  c_max_valid_per_day     constant int := 3;    -- MAX_VALID_SESSIONS_PER_DAY
  -- SPEC-04 §1
  c_min_session_sec       constant int := 180;  -- MIN_SESSION_SEC
  c_boss_every_n          constant int := 7;    -- BOSS_EVERY_N_SESSIONS

  v_session        public.sessions%ROWTYPE;
  v_profile        public.profiles%ROWTYPE;
  v_today          date;
  v_monday         date;
  v_valid_today    int;
  v_base           int := 0;
  v_duration_xp    int := 0;
  v_double         int := 0;
  v_challenge      int := 0;
  v_streak_bonus   int := 0;
  v_xp             int := 0;
  v_streak         int;
  v_streak_changed boolean := false;
  v_is_double      boolean := false;
  v_sessions_count int;
BEGIN
  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = v_session.user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  -- Idempotencia: la API y el session-sweeper pueden cerrar la misma sesión.
  IF v_session.status <> 'active' THEN
    RETURN jsonb_build_object(
      'xp_earned',     v_session.xp_earned,
      'streak',        v_profile.streak,
      'is_double_day', false,
      'next_is_boss',  ((v_profile.sessions_count + 1) % c_boss_every_n) = 0
    );
  END IF;

  v_today  := (now() AT TIME ZONE v_profile.timezone)::date;
  v_monday := date_trunc('week', v_today::timestamp)::date;

  -- Sesión corta o sin conversación: se cierra sin XP y no toca el streak.
  IF p_duration_sec < c_min_session_sec OR p_turns_count < 2 THEN
    UPDATE public.sessions
       SET status       = 'ended',
           ended_at     = now(),
           duration_sec = p_duration_sec,
           turns_count  = p_turns_count,
           xp_earned    = 0
     WHERE id = p_session_id;

    RETURN jsonb_build_object(
      'xp_earned',     0,
      'streak',        v_profile.streak,
      'is_double_day', false,
      'next_is_boss',  ((v_profile.sessions_count + 1) % c_boss_every_n) = 0
    );
  END IF;

  SELECT count(*) INTO v_valid_today
  FROM public.sessions s
  WHERE s.user_id = v_session.user_id
    AND s.id <> p_session_id
    AND s.status = 'ended'
    AND s.xp_earned > 0
    AND s.ended_at IS NOT NULL
    AND (s.ended_at AT TIME ZONE v_profile.timezone)::date = v_today;

  -- A partir de MAX_VALID_SESSIONS_PER_DAY la sesión no da XP, pero sí cuenta
  -- para el streak.
  IF v_valid_today < c_max_valid_per_day THEN
    v_base        := c_xp_session_base;
    v_duration_xp := least(
                       c_xp_duration_cap,
                       greatest(0, (p_duration_sec / 60) - 5) * c_xp_per_minute_after_5
                     );

    IF v_session.kind = 'boss' THEN
      v_base        := v_base * c_xp_boss_multiplier;
      v_duration_xp := v_duration_xp * c_xp_boss_multiplier;
    END IF;

    IF v_valid_today = 1 THEN
      v_double    := c_xp_double_day_bonus;
      v_is_double := true;
    END IF;

    IF v_session.challenge_from_user_id IS NOT NULL THEN
      v_challenge := c_xp_challenge_bonus;
    END IF;

    v_xp := v_base + v_duration_xp + v_double + v_challenge;
  END IF;

  -- Streak (SPEC-07 §2).
  v_streak := v_profile.streak;
  IF v_profile.last_session_day = v_today THEN
    NULL;                                   -- segunda sesión del mismo día
  ELSIF v_profile.last_session_day = v_today - 1 THEN
    v_streak := v_streak + 1;
    v_streak_changed := true;
  ELSIF v_profile.last_session_day = v_today - 2
        AND v_profile.grace_used_week = v_monday THEN
    v_streak := v_streak + 1;               -- la gracia ya la aplicó el job
    v_streak_changed := true;
  ELSE
    v_streak := 1;
    v_streak_changed := true;
  END IF;

  -- El bonus de los 7 días solo se paga cuando el streak avanza en esta
  -- llamada; si no, la segunda sesión del día lo cobraría otra vez.
  -- Ver PENDIENTES.
  IF v_streak_changed AND v_streak % 7 = 0 THEN
    v_streak_bonus := c_xp_streak_7_bonus;
    v_xp := v_xp + v_streak_bonus;
  END IF;

  UPDATE public.sessions
     SET status       = 'ended',
         ended_at     = now(),
         duration_sec = p_duration_sec,
         turns_count  = p_turns_count,
         xp_earned    = v_xp
   WHERE id = p_session_id;

  -- Auditoría: cada componente su fila (SPEC-01 §2.13).
  IF v_base > 0 THEN
    INSERT INTO public.xp_events (user_id, session_id, kind, amount)
    VALUES (v_session.user_id, p_session_id, 'session', v_base);
  END IF;
  IF v_duration_xp > 0 THEN
    INSERT INTO public.xp_events (user_id, session_id, kind, amount)
    VALUES (v_session.user_id, p_session_id, 'duration_bonus', v_duration_xp);
  END IF;
  IF v_double > 0 THEN
    INSERT INTO public.xp_events (user_id, session_id, kind, amount)
    VALUES (v_session.user_id, p_session_id, 'double_day', v_double);
  END IF;
  IF v_challenge > 0 THEN
    INSERT INTO public.xp_events (user_id, session_id, kind, amount)
    VALUES (v_session.user_id, p_session_id, 'challenge', v_challenge);
  END IF;
  IF v_streak_bonus > 0 THEN
    INSERT INTO public.xp_events (user_id, session_id, kind, amount)
    VALUES (v_session.user_id, p_session_id, 'streak_7', v_streak_bonus);
  END IF;

  UPDATE public.profiles
     SET xp               = xp + v_xp,
         streak           = v_streak,
         longest_streak   = greatest(longest_streak, v_streak),
         last_session_day = v_today,
         sessions_count   = sessions_count + 1
   WHERE user_id = v_session.user_id
  RETURNING sessions_count INTO v_sessions_count;

  RETURN jsonb_build_object(
    'xp_earned',     v_xp,
    'streak',        v_streak,
    'is_double_day', v_is_double,
    'next_is_boss',  ((v_sessions_count + 1) % c_boss_every_n) = 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.close_session(uuid, int, int) FROM PUBLIC, anon, authenticated;
