-- Test SQL de award_badges (migración 20260919200000).
-- Ejecutar desde apps/api con:
--   ./scripts/run-sql-test.sh migrations/tests/badges.sql
-- Requiere los usuarios de prueba: node scripts/db-test-users.ts
--
-- Si algo falla, el bloque lanza RAISE EXCEPTION y se revierte entero.

DO $test$
DECLARE
  v_a       uuid;
  v_session uuid;
  v_new     text[];
  v_default uuid;
BEGIN
  SELECT id INTO v_a FROM auth.users WHERE email = 'sqltest-a@fluent.test';
  IF v_a IS NULL THEN
    RAISE EXCEPTION 'faltan usuarios de prueba; ejecuta: node scripts/db-test-users.ts';
  END IF;

  -- Estado limpio (sin grupo por defecto para no depender de él).
  SELECT id INTO v_default FROM public.groups WHERE is_default;
  UPDATE public.groups SET is_default = false WHERE is_default;
  DELETE FROM public.user_badges WHERE user_id = v_a;
  DELETE FROM public.sessions WHERE user_id = v_a;
  DELETE FROM public.profiles WHERE user_id = v_a;

  INSERT INTO public.profiles (user_id, display_name, level, xp, streak, longest_streak, sessions_count)
    VALUES (v_a, 'Test A', 'B1', 600, 2, 8, 12);

  -- Una sesión desafío válida y sin correcciones.
  INSERT INTO public.sessions (user_id, kind, topic, status, ended_at, duration_sec, turns_count, xp_earned)
    VALUES (v_a, 'boss', 'Travel', 'ended', now(), 400, 5, 160)
    RETURNING id INTO v_session;

  -- ---- otorga lo que ya cumple, en orden de catálogo -----------------------
  v_new := public.award_badges(v_a, v_session);
  IF v_new IS DISTINCT FROM ARRAY[
       'level_newcomer', 'level_chatterbox', 'streak_3', 'streak_7',
       'first_session', 'sessions_10', 'boss_won', 'no_corrections'] THEN
    RAISE EXCEPTION 'award_badges devolvió %', v_new;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_badges
                 WHERE user_id = v_a AND badge_id = 'boss_won' AND session_id = v_session) THEN
    RAISE EXCEPTION 'la insignia no guardó la sesión que la otorgó';
  END IF;

  -- ---- idempotente: una segunda llamada no otorga nada ---------------------
  v_new := public.award_badges(v_a, v_session);
  IF cardinality(v_new) <> 0 THEN
    RAISE EXCEPTION 'la segunda llamada debía devolver vacío, devolvió %', v_new;
  END IF;

  -- ---- una sesión corta no cuenta para las especiales ----------------------
  DELETE FROM public.user_badges WHERE user_id = v_a;
  UPDATE public.sessions SET duration_sec = 60 WHERE id = v_session;
  v_new := public.award_badges(v_a, v_session);
  IF 'boss_won' = ANY (v_new) OR 'no_corrections' = ANY (v_new) THEN
    RAISE EXCEPTION 'una sesión de 60 s no debía otorgar especiales: %', v_new;
  END IF;

  -- ---- una insignia desactivada no se otorga -------------------------------
  DELETE FROM public.user_badges WHERE user_id = v_a;
  UPDATE public.badges SET active = false WHERE id = 'level_chatterbox';
  v_new := public.award_badges(v_a, NULL);
  IF 'level_chatterbox' = ANY (v_new) THEN
    RAISE EXCEPTION 'una insignia inactiva no debía otorgarse';
  END IF;
  UPDATE public.badges SET active = true WHERE id = 'level_chatterbox';

  -- ---- limpieza ------------------------------------------------------------
  DELETE FROM public.user_badges WHERE user_id = v_a;
  DELETE FROM public.sessions WHERE user_id = v_a;
  DELETE FROM public.profiles WHERE user_id = v_a;
  UPDATE public.groups SET is_default = true WHERE id = v_default;

  RAISE NOTICE 'badges: todas las comprobaciones en verde';
END;
$test$;
