-- F9.1.T1 · cierre de la sala grupal con XP y streak.
-- Cubre: docs/arch/002-sesion-grupal.md §Data model, specs/f9-progreso-grupal.md#F9.1.T1.
--
-- 1. `advance_streak`: el bloque de streak de `close_session` (migración
--    20260908190806), extraído sin cambios para que lo usen las dos funciones
--    de cierre.
-- 2. `close_session` reescrita sobre `advance_streak`; mismo comportamiento
--    (lo cubre migrations/tests/close_session.sql).
-- 3. `close_group_session`.

-- ---------------------------------------------------------------------------
-- 1. advance_streak (SPEC-07 §2). Avanza `profiles.streak` /
--    `longest_streak` / `last_session_day` con el día de `p_ended_at` en la
--    zona del perfil y devuelve `{streak, bonus}`. `bonus` es el XP de
--    `streak_7` (0 si no toca); quien llama inserta el xp_event y lo suma.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.advance_streak(
  p_user_id  uuid,
  p_ended_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  c_xp_streak_7_bonus constant int := 40;   -- XP_STREAK_7_BONUS (SPEC-07 §1)

  v_profile        public.profiles%ROWTYPE;
  v_today          date;
  v_monday         date;
  v_streak         int;
  v_streak_changed boolean := false;
  v_bonus          int := 0;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  v_today  := (p_ended_at AT TIME ZONE v_profile.timezone)::date;
  v_monday := date_trunc('week', v_today::timestamp)::date;

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
  -- Ver docs/specs/pendientes/PR-01.md.
  IF v_streak_changed AND v_streak % 7 = 0 THEN
    v_bonus := c_xp_streak_7_bonus;
  END IF;

  UPDATE public.profiles
     SET streak           = v_streak,
         longest_streak   = greatest(longest_streak, v_streak),
         last_session_day = v_today
   WHERE user_id = p_user_id;

  RETURN jsonb_build_object('streak', v_streak, 'bonus', v_bonus);
END;
$$;

REVOKE ALL ON FUNCTION public.advance_streak(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. close_session (SPEC-01 §5, SPEC-07 §2), igual que antes salvo que el
--    streak lo calcula `advance_streak`.
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
  c_max_valid_per_day     constant int := 3;    -- MAX_VALID_SESSIONS_PER_DAY
  -- SPEC-04 §1
  c_min_session_sec       constant int := 180;  -- MIN_SESSION_SEC
  c_boss_every_n          constant int := 7;    -- BOSS_EVERY_N_SESSIONS

  v_session        public.sessions%ROWTYPE;
  v_profile        public.profiles%ROWTYPE;
  v_today          date;
  v_valid_today    int;
  v_base           int := 0;
  v_duration_xp    int := 0;
  v_double         int := 0;
  v_challenge      int := 0;
  v_streak_bonus   int := 0;
  v_xp             int := 0;
  v_streak_res     jsonb;
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

  v_today := (now() AT TIME ZONE v_profile.timezone)::date;

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
  v_streak_res   := public.advance_streak(v_session.user_id, now());
  v_streak_bonus := (v_streak_res ->> 'bonus')::int;
  v_xp           := v_xp + v_streak_bonus;

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
     SET xp             = xp + v_xp,
         sessions_count = sessions_count + 1
   WHERE user_id = v_session.user_id
  RETURNING sessions_count INTO v_sessions_count;

  RETURN jsonb_build_object(
    'xp_earned',     v_xp,
    'streak',        (v_streak_res ->> 'streak')::int,
    'is_double_day', v_is_double,
    'next_is_boss',  ((v_sessions_count + 1) % c_boss_every_n) = 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.close_session(uuid, int, int) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. close_group_session (FR-5, FR-16, FR-17). Constantes reflejadas en
--    apps/api/src/config/product.ts como GROUP_XP_* / GROUP_STREAK_MIN_MESSAGES.
--    Devuelve `[{userId, sessionId, xp, streak}]`, uno por participante con al
--    menos un mensaje; `xp` es `sessions.xp_earned` (incluye el bonus
--    `streak_7`) y `streak` el streak actual del perfil.
--    No suma `profiles.sessions_count`: ese contador marca la cadencia del
--    boss, que es de las sesiones 1:1.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_group_session(
  p_session_id uuid,
  p_reason     text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  c_xp_per_message      constant int := 5;   -- GROUP_XP_PER_MESSAGE
  c_xp_messages_cap     constant int := 60;  -- GROUP_XP_MESSAGES_CAP
  c_xp_per_present_min  constant int := 2;   -- GROUP_XP_PER_PRESENT_MIN
  c_xp_presence_cap     constant int := 30;  -- GROUP_XP_PRESENCE_CAP
  c_streak_min_messages constant int := 5;   -- GROUP_STREAK_MIN_MESSAGES

  v_gs     public.group_sessions%ROWTYPE;
  v_now    timestamptz := now();
  v_p      record;
  v_xp     int;
  v_bonus  int;
  v_sid    uuid;
BEGIN
  SELECT * INTO v_gs FROM public.group_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GROUP_SESSION_NOT_FOUND';
  END IF;

  -- Idempotencia: el iniciador y el sweeper pueden cerrar la misma sala. El
  -- FOR UPDATE serializa las llamadas; la segunda ve `ended` y solo lee.
  IF v_gs.status = 'active' THEN
    UPDATE public.group_sessions
       SET status     = 'ended',
           ended_at   = v_now,
           end_reason = p_reason
     WHERE id = p_session_id;

    UPDATE public.group_session_participants
       SET present_sec = present_sec
                         + greatest(0, floor(extract(epoch FROM v_now - joined_at)))::int,
           left_at     = v_now
     WHERE session_id = p_session_id
       AND left_at IS NULL;

    FOR v_p IN
      SELECT user_id, present_sec, messages_count
      FROM public.group_session_participants
      WHERE session_id = p_session_id
        AND messages_count >= 1
      ORDER BY user_id
    LOOP
      v_xp := least(v_p.messages_count * c_xp_per_message, c_xp_messages_cap)
            + least((v_p.present_sec / 60) * c_xp_per_present_min, c_xp_presence_cap);
      v_bonus := 0;

      IF v_p.messages_count >= c_streak_min_messages THEN
        v_bonus := (public.advance_streak(v_p.user_id, v_now) ->> 'bonus')::int;
      END IF;

      INSERT INTO public.sessions (user_id, kind, topic, group_session_id, status,
                                   started_at, ended_at, duration_sec, turns_count,
                                   xp_earned)
      VALUES (v_p.user_id, 'group', coalesce(v_gs.topic, v_gs.kind), p_session_id,
              'ended', v_gs.started_at, v_now, v_p.present_sec, v_p.messages_count,
              v_xp + v_bonus)
      RETURNING id INTO v_sid;

      INSERT INTO public.xp_events (user_id, session_id, kind, amount)
      VALUES (v_p.user_id, v_sid, 'group', v_xp);
      IF v_bonus > 0 THEN
        INSERT INTO public.xp_events (user_id, session_id, kind, amount)
        VALUES (v_p.user_id, v_sid, 'streak_7', v_bonus);
      END IF;

      UPDATE public.profiles
         SET xp = xp + v_xp + v_bonus
       WHERE user_id = v_p.user_id;
    END LOOP;
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'userId',    s.user_id,
             'sessionId', s.id,
             'xp',        s.xp_earned,
             'streak',    p.streak
           ) ORDER BY s.user_id)
    FROM public.sessions s
    JOIN public.profiles p ON p.user_id = s.user_id
    WHERE s.group_session_id = p_session_id
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.close_group_session(uuid, text) FROM PUBLIC, anon, authenticated;
