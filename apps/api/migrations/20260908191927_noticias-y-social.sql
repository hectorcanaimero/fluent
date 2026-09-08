-- SPEC-01 §6 migración 5 · contenido y social
-- Cubre: SPEC-01 §2.11 (news_items), §2.12 (weekly_summaries), §3 (RLS),
--        §5 (`weekly_leaderboard`), SPEC-07 §5 (leaderboard) y §6 (streak
--        grupal), SPEC-05 §6 (`apply_streak_grace`, `update_group_streaks`).
-- Decisiones fuera de spec: docs/specs/PENDIENTES.md, entradas 23 a 25.

-- ---------------------------------------------------------------------------
-- 1. news_items (SPEC-01 §2.11, RF-7.1)
--    Retención de 14 días: la borra el job `retention` (SPEC-05 §7), no esta
--    migración.
-- ---------------------------------------------------------------------------
CREATE TABLE public.news_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source       text NOT NULL,
  url          text NOT NULL UNIQUE,
  title        text NOT NULL,
  summary      text,
  tags         text[] NOT NULL DEFAULT '{}',
  published_at timestamptz,
  day          date NOT NULL DEFAULT current_date
);

CREATE INDEX news_items_day_idx ON public.news_items (day DESC);
CREATE INDEX news_items_tags_idx ON public.news_items USING gin (tags);

-- La FK que la migración 3 no pudo declarar todavía (SPEC-01 §2.6, PENDIENTES §14).
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_news_item_id_fkey
  FOREIGN KEY (news_item_id) REFERENCES public.news_items(id) ON DELETE SET NULL;
-- El índice sessions_news_item_idx ya lo creó la migración 3.

-- news_items: cualquier usuario autenticado lee todas las filas; nada de
-- escritura desde la app (SPEC-01 §3, lo ingesta el job `rss-ingest`).
ALTER TABLE public.news_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.news_items FROM anon, authenticated;
GRANT SELECT ON public.news_items TO authenticated;

CREATE POLICY news_items_select_all ON public.news_items
  FOR SELECT TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- 2. weekly_summaries (SPEC-01 §2.12, RF-6.3)
-- ---------------------------------------------------------------------------
CREATE TABLE public.weekly_summaries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  text       text NOT NULL,
  stats      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- "lunes": SPEC-01 §2.12 lo pide en la nota de la columna, no como CHECK.
  -- ISODOW = 1 es lunes.
  CHECK (EXTRACT(ISODOW FROM week_start) = 1),
  UNIQUE (group_id, week_start)
);

-- weekly_summaries: solo lectura del propio grupo; lo escribe el job
-- `weekly-summary` con la clave admin (SPEC-05 §4, SPEC-01 §3).
ALTER TABLE public.weekly_summaries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.weekly_summaries FROM anon, authenticated;
GRANT SELECT ON public.weekly_summaries TO authenticated;

CREATE POLICY weekly_summaries_select_own_group ON public.weekly_summaries
  FOR SELECT TO authenticated
  USING (group_id = public.current_group_id());

-- ---------------------------------------------------------------------------
-- 3. weekly_leaderboard (SPEC-01 §5, SPEC-07 §5)
--    XP de la semana (suma de xp_events.amount) y sesiones válidas por
--    miembro del grupo, con empates resueltos por más sesiones y luego menor
--    user_id. Devuelve todos los miembros, incluidos los de 0 XP.
--
--    La llaman tanto la app (token de usuario) como la API (clave admin).
--    Al ser SECURITY DEFINER, sin este chequeo un usuario podría pedir el
--    leaderboard de un grupo ajeno pasando cualquier group_id: si hay un
--    usuario autenticado (auth.uid() no nulo) y su grupo no es p_group_id,
--    se rechaza. Con la clave admin auth.uid() es nulo y no se filtra.
--    Ver PENDIENTES §23.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.weekly_leaderboard(p_group_id uuid, p_week_start date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND public.current_group_id() IS DISTINCT FROM p_group_id THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT coalesce(jsonb_agg(
           jsonb_build_object(
             'user_id',      ranked.user_id,
             'display_name', ranked.display_name,
             'xp',           ranked.xp,
             'sessions',     ranked.sessions,
             'rank',         ranked.rank
           ) ORDER BY ranked.rank
         ), '[]'::jsonb)
    INTO v_result
  FROM (
    SELECT
      p.user_id,
      p.display_name,
      coalesce(xp.total, 0)    AS xp,
      coalesce(sess.total, 0)  AS sessions,
      row_number() OVER (
        ORDER BY coalesce(xp.total, 0) DESC,
                 coalesce(sess.total, 0) DESC,
                 p.user_id ASC
      ) AS rank
    FROM public.profiles p
    LEFT JOIN (
      -- La ventana es lunes 00:00 UTC a lunes 00:00 UTC (SPEC-07 §5). Se
      -- convierte a timestamptz explícitamente para no depender del
      -- `TimeZone` de la sesión de Postgres.
      SELECT e.user_id, sum(e.amount) AS total
      FROM public.xp_events e
      WHERE e.created_at >= (p_week_start::timestamp AT TIME ZONE 'UTC')
        AND e.created_at <  ((p_week_start + 7)::timestamp AT TIME ZONE 'UTC')
      GROUP BY e.user_id
    ) xp ON xp.user_id = p.user_id
    LEFT JOIN (
      -- "ended_at": mismo criterio que close_session para el día de la
      -- sesión (PENDIENTES §17).
      SELECT s.user_id, count(*) AS total
      FROM public.sessions s
      WHERE s.status = 'ended'
        AND s.xp_earned > 0
        AND s.ended_at >= (p_week_start::timestamp AT TIME ZONE 'UTC')
        AND s.ended_at <  ((p_week_start + 7)::timestamp AT TIME ZONE 'UTC')
      GROUP BY s.user_id
    ) sess ON sess.user_id = p.user_id
    WHERE p.group_id = p_group_id
  ) ranked;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.weekly_leaderboard(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_leaderboard(uuid, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. apply_streak_grace (SPEC-05 §6 paso 1, SPEC-07 §3)
--    Job diario `daily-streaks`, EXECUTE solo para el rol admin (sin GRANT a
--    authenticated). "Hoy", "ayer" y "anteayer" se calculan en la zona
--    horaria de cada perfil.
--
--    La tercera rama (gracia ya aplicada esta semana → no tocar nada) no la
--    pide SPEC-05 §6 al pie de la letra: sin ella, una segunda ejecución del
--    job el mismo día pondría el streak a 0 justo después de haber concedido
--    la gracia, rompiendo la idempotencia que exige SPEC-05 §1.
--    Ver PENDIENTES §24.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_streak_grace()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_profile   public.profiles%ROWTYPE;
  v_today     date;
  v_yesterday date;
  v_before    date;   -- anteayer
  v_monday    date;
  v_graced    int := 0;
  v_reset     int := 0;
BEGIN
  FOR v_profile IN SELECT * FROM public.profiles FOR UPDATE LOOP
    v_today     := (now() AT TIME ZONE v_profile.timezone)::date;
    v_yesterday := v_today - 1;
    v_before    := v_today - 2;
    v_monday    := date_trunc('week', v_today::timestamp)::date;

    IF v_profile.last_session_day IS NULL OR v_profile.last_session_day >= v_yesterday THEN
      -- practicó ayer o algo más reciente (o nunca practicó): nada que hacer.
      CONTINUE;
    ELSIF v_profile.last_session_day = v_before
          AND v_profile.grace_used_week IS DISTINCT FROM v_monday THEN
      -- gracia: el streak queda intacto, se marca la semana como usada.
      UPDATE public.profiles
         SET grace_used_week = v_monday
       WHERE user_id = v_profile.user_id;
      v_graced := v_graced + 1;
    ELSIF v_profile.last_session_day = v_before
          AND v_profile.grace_used_week = v_monday THEN
      -- la gracia de esta semana ya se aplicó (ejecución repetida el mismo
      -- día): no se toca nada, así el job es idempotente.
      CONTINUE;
    ELSE
      UPDATE public.profiles
         SET streak = 0
       WHERE user_id = v_profile.user_id;
      v_reset := v_reset + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('graced', v_graced, 'reset', v_reset);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_streak_grace() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. update_group_streaks (SPEC-05 §6 paso 2, SPEC-07 §6)
--    Ni SPEC-01 §5 ni SPEC-05 §6 nombran esta RPC ni la columna
--    `group_streak_day`: la spec solo describe la regla de negocio ("streak
--    grupal: si todos los miembros activos practicaron ayer, +1; si no, 0"),
--    sin decir dónde vive el job ni cómo lo hace idempotente si se ejecuta
--    dos veces el mismo día. Se resuelve con una función propia y una
--    columna que guarda el último día (UTC) en que se actualizó el grupo, a
--    imagen de `close_session`/`last_session_day`. Ver PENDIENTES §25.
-- ---------------------------------------------------------------------------
ALTER TABLE public.groups ADD COLUMN group_streak_day date;

CREATE OR REPLACE FUNCTION public.update_group_streaks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  c_active_days constant int := 14;  -- SPEC-07 §6: activo = sesión en los últimos 14 días

  v_group         public.groups%ROWTYPE;
  v_active_count  int;
  v_all_yesterday boolean;
  v_advanced      int := 0;
  v_reset         int := 0;
  v_skipped       int := 0;
BEGIN
  FOR v_group IN SELECT * FROM public.groups FOR UPDATE LOOP
    IF v_group.group_streak_day = current_date THEN
      -- ya se actualizó hoy: segunda ejecución del mismo día no repite nada.
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT
      count(*),
      bool_and(p.last_session_day >= (now() AT TIME ZONE p.timezone)::date - 1)
      INTO v_active_count, v_all_yesterday
    FROM public.profiles p
    WHERE p.group_id = v_group.id
      AND p.onboarded_at IS NOT NULL
      AND p.last_session_day >= (now() AT TIME ZONE p.timezone)::date - c_active_days;

    IF v_active_count > 0 AND coalesce(v_all_yesterday, false) THEN
      UPDATE public.groups
         SET group_streak     = group_streak + 1,
             group_streak_day = current_date
       WHERE id = v_group.id;
      v_advanced := v_advanced + 1;
    ELSE
      UPDATE public.groups
         SET group_streak     = 0,
             group_streak_day = current_date
       WHERE id = v_group.id;
      v_reset := v_reset + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('advanced', v_advanced, 'reset', v_reset, 'skipped', v_skipped);
END;
$$;

REVOKE ALL ON FUNCTION public.update_group_streaks() FROM PUBLIC, anon, authenticated;
