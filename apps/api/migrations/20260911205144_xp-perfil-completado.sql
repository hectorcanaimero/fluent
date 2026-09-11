-- MEJ-14: 20 XP la primera vez que el usuario completa su perfil.
--
-- El propósito es que la barra de nivel no arranque en 0 (endowed progress):
-- entrar a Home con algo ya ganado sostiene mejor la activación que un cero.
--
-- Tres piezas:
--   1. `xp_events.kind` admite `profile_completed`.
--   2. Un índice único parcial garantiza **una sola** concesión por usuario,
--      aunque dos peticiones lleguen a la vez: la idempotencia no puede
--      depender de un SELECT previo desde la API.
--   3. `award_profile_completed` suma el XP y registra el evento en la misma
--      transacción, y devuelve cuánto concedió (0 si ya estaba concedido).

ALTER TABLE public.xp_events
  DROP CONSTRAINT xp_events_kind_check;

ALTER TABLE public.xp_events
  ADD CONSTRAINT xp_events_kind_check
  CHECK (kind IN ('session', 'duration_bonus', 'double_day',
                  'boss', 'challenge', 'streak_7', 'profile_completed'));

-- Uno por usuario, y solo para este `kind`: el resto se repiten a propósito.
CREATE UNIQUE INDEX xp_events_profile_completed_once_idx
  ON public.xp_events (user_id)
  WHERE kind = 'profile_completed';

CREATE OR REPLACE FUNCTION public.award_profile_completed(
  p_user_id uuid,
  p_amount  int
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_inserted int;
BEGIN
  IF p_amount <= 0 THEN
    RETURN 0;
  END IF;

  -- `ON CONFLICT DO NOTHING` sobre el índice parcial: si ya había evento, no
  -- inserta y `v_inserted` queda en 0, así que tampoco se suma el XP. Esa es
  -- toda la idempotencia, y vive en la base para que dos peticiones
  -- simultáneas no puedan concederlo dos veces.
  INSERT INTO public.xp_events (user_id, session_id, kind, amount)
  VALUES (p_user_id, NULL, 'profile_completed', p_amount)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.profiles
     SET xp = xp + p_amount
   WHERE user_id = p_user_id;

  RETURN p_amount;
END;
$$;

REVOKE ALL ON FUNCTION public.award_profile_completed(uuid, int) FROM PUBLIC, anon, authenticated;
