-- Insignias de logros (ronda 4).
--
-- El catálogo vive en la base (no en código) para poder cambiar umbrales,
-- orden o desactivar una insignia sin publicar la app. Las imágenes están en
-- el bucket público `badges` como <image_key>; reemplazar el archivo con la
-- misma key cambia la imagen sin tocar nada más.
--
-- `award_badges` se llama después de `close_session` (y una vez acá, como
-- backfill). Es idempotente: solo inserta lo que falta y devuelve lo nuevo.

-- ---------------------------------------------------------------------------
-- 1. Catálogo
-- ---------------------------------------------------------------------------
CREATE TABLE public.badges (
  id         text PRIMARY KEY,
  category   text NOT NULL CHECK (category IN ('level', 'streak', 'sessions', 'special')),
  -- Meta para level (XP), streak (días) y sessions (sesiones); null en special.
  threshold  int CHECK (threshold IS NULL OR threshold >= 0),
  sort_order int NOT NULL,
  image_key  text NOT NULL,
  active     boolean NOT NULL DEFAULT true
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.badges FROM anon, authenticated;

INSERT INTO public.badges (id, category, threshold, sort_order, image_key) VALUES
  ('level_newcomer',    'level',    0,    10,  'level_newcomer.png'),
  ('level_chatterbox',  'level',    500,  20,  'level_chatterbox.png'),
  ('level_storyteller', 'level',    1500, 30,  'level_storyteller.png'),
  ('level_debater',     'level',    3500, 40,  'level_debater.png'),
  ('level_native_ish',  'level',    7000, 50,  'level_native_ish.png'),
  ('streak_3',          'streak',   3,    60,  'streak_3.png'),
  ('streak_7',          'streak',   7,    70,  'streak_7.png'),
  ('streak_30',         'streak',   30,   80,  'streak_30.png'),
  ('streak_100',        'streak',   100,  90,  'streak_100.png'),
  ('first_session',     'sessions', 1,    100, 'first_session.png'),
  ('sessions_10',       'sessions', 10,   110, 'sessions_10.png'),
  ('sessions_50',       'sessions', 50,   120, 'sessions_50.png'),
  ('sessions_100',      'sessions', 100,  130, 'sessions_100.png'),
  ('boss_won',          'special',  NULL, 140, 'boss_won.png'),
  ('no_corrections',    'special',  NULL, 150, 'no_corrections.png'),
  ('double_day',        'special',  NULL, 160, 'double_day.png');

-- ---------------------------------------------------------------------------
-- 2. Insignias ganadas
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_badges (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id   text NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at  timestamptz NOT NULL DEFAULT now(),
  -- Sesión que la otorgó; null en el backfill.
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_badges FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. award_badges: otorga lo que el usuario ya cumple y devuelve los ids nuevos
-- ---------------------------------------------------------------------------
-- Sesión válida = mismo criterio que close_session: terminada, ≥ 180 s y
-- ≥ 2 turnos del usuario (MIN_SESSION_SEC).
CREATE OR REPLACE FUNCTION public.award_badges(
  p_user_id    uuid,
  p_session_id uuid DEFAULT NULL
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_new text[];
BEGIN
  WITH p AS (
    SELECT xp, greatest(streak, longest_streak) AS best_streak, sessions_count
    FROM public.profiles
    WHERE user_id = p_user_id
  ),
  valid AS (
    SELECT s.id, s.kind
    FROM public.sessions s
    WHERE s.user_id = p_user_id
      AND s.status = 'ended'
      AND s.duration_sec >= 180
      AND s.turns_count >= 2
  ),
  eligible AS (
    SELECT b.id
    FROM public.badges b, p
    WHERE b.active
      AND (
           (b.category = 'level'    AND p.xp             >= b.threshold)
        OR (b.category = 'streak'   AND p.best_streak    >= b.threshold)
        OR (b.category = 'sessions' AND p.sessions_count >= b.threshold)
        OR (b.id = 'boss_won'       AND EXISTS (SELECT 1 FROM valid WHERE kind = 'boss'))
        OR (b.id = 'no_corrections' AND EXISTS (
              SELECT 1 FROM valid v
              WHERE NOT EXISTS (SELECT 1 FROM public.corrections c WHERE c.session_id = v.id)))
        OR (b.id = 'double_day'     AND EXISTS (
              SELECT 1 FROM public.xp_events e
              WHERE e.user_id = p_user_id AND e.kind = 'double_day'))
      )
  ),
  inserted AS (
    INSERT INTO public.user_badges (user_id, badge_id, session_id)
    SELECT p_user_id, id, p_session_id FROM eligible
    ON CONFLICT (user_id, badge_id) DO NOTHING
    RETURNING badge_id
  )
  SELECT coalesce(array_agg(i.badge_id ORDER BY b.sort_order), '{}')
    INTO v_new
  FROM inserted i
  JOIN public.badges b ON b.id = i.badge_id;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.award_badges(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Backfill: los usuarios actuales reciben lo que ya ganaron
-- ---------------------------------------------------------------------------
SELECT public.award_badges(user_id) FROM public.profiles;
