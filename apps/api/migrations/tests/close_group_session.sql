-- Test SQL de `close_group_session` (migración 20261006130000).
-- Ejecutar desde apps/api con:
--   ./scripts/run-sql-test.sh migrations/tests/close_group_session.sql
-- Requiere los usuarios de prueba: node scripts/db-test-users.ts
--
-- Cubre: tres participantes con 0, 3 y 6 mensajes (solo dos filas `sessions`,
-- solo el de 6 avanza el streak), XP sin topes, los dos topes de XP, el cierre
-- de la presencia, el bonus `streak_7` y la idempotencia. Cualquier fallo lanza
-- RAISE EXCEPTION.
--
-- Los perfiles de prueba usan timezone 'UTC' para que "hoy" sea determinista.

DO $test$
DECLARE
  v_a      uuid;
  v_b      uuid;
  v_c      uuid;
  v_group  uuid;
  v_gs     uuid;
  v_gs2    uuid;
  v_res    jsonb;
  v_res2   jsonb;
  v_today  date;
  v_n      int;
  v_xp     int;
  v_streak int;
  v_day    date;
  v_status text;
BEGIN
  SELECT id INTO v_a FROM auth.users WHERE email = 'sqltest-a@fluent.test';
  SELECT id INTO v_b FROM auth.users WHERE email = 'sqltest-b@fluent.test';
  SELECT id INTO v_c FROM auth.users WHERE email = 'sqltest-c@fluent.test';
  IF v_a IS NULL OR v_b IS NULL OR v_c IS NULL THEN
    RAISE EXCEPTION 'faltan usuarios de prueba; ejecuta: node scripts/db-test-users.ts';
  END IF;

  v_today := (now() AT TIME ZONE 'UTC')::date;

  INSERT INTO public.groups (name) VALUES ('test-close-group-session')
    RETURNING id INTO v_group;

  DELETE FROM public.xp_events WHERE user_id IN (v_a, v_b, v_c);
  DELETE FROM public.sessions  WHERE user_id IN (v_a, v_b, v_c);
  DELETE FROM public.profiles  WHERE user_id IN (v_a, v_b, v_c);
  INSERT INTO public.profiles (user_id, group_id, display_name, level, timezone, onboarded_at)
  VALUES (v_a, v_group, 'Test cero', 'B1', 'UTC', now()),
         (v_b, v_group, 'Test tres', 'B1', 'UTC', now()),
         (v_c, v_group, 'Test seis', 'B1', 'UTC', now());

  -- =========================================================================
  -- 1. 0, 3 y 6 mensajes. A sigue en la sala (la presencia la cierra el
  --    cierre); B salió con 150 s; C sigue en la sala desde hace 10 min y
  --    tenía 0 s acumulados.
  -- =========================================================================
  INSERT INTO public.group_sessions (group_id, initiator_id, kind, topic, started_at)
  VALUES (v_group, v_c, 'free_topic', 'cierre grupal', now() - interval '20 minutes')
    RETURNING id INTO v_gs;

  INSERT INTO public.group_session_participants
    (session_id, user_id, joined_at, left_at, present_sec, messages_count)
  VALUES (v_gs, v_a, now() - interval '5 minutes', NULL, 0, 0),
         (v_gs, v_b, now() - interval '15 minutes', now() - interval '5 minutes', 150, 3),
         (v_gs, v_c, now() - interval '10 minutes', NULL, 0, 6);

  v_res := public.close_group_session(v_gs, 'initiator');

  SELECT status INTO v_status FROM public.group_sessions WHERE id = v_gs;
  IF v_status <> 'ended' THEN
    RAISE EXCEPTION 'la sala debía quedar ended, quedó %', v_status;
  END IF;

  SELECT count(*) INTO v_n FROM public.group_session_participants
  WHERE session_id = v_gs AND left_at IS NULL;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'el cierre debía cerrar la presencia de todos, quedan % activos', v_n;
  END IF;
  SELECT present_sec INTO v_n FROM public.group_session_participants
  WHERE session_id = v_gs AND user_id = v_c;
  IF v_n NOT BETWEEN 599 AND 601 THEN
    RAISE EXCEPTION 'C debía acumular ~600 s de presencia, tiene %', v_n;
  END IF;
  SELECT present_sec INTO v_n FROM public.group_session_participants
  WHERE session_id = v_gs AND user_id = v_b;
  IF v_n <> 150 THEN
    RAISE EXCEPTION 'B ya había salido; su present_sec no debía cambiar, tiene %', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM public.sessions WHERE group_session_id = v_gs;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'solo los participantes con mensajes tienen fila sessions: debía haber 2, hay %', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.sessions WHERE user_id = v_a;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'A no envió mensajes y no debía tener fila sessions';
  END IF;
  IF jsonb_array_length(v_res) <> 2 THEN
    RAISE EXCEPTION 'el resultado debía tener 2 entradas, dio %', v_res;
  END IF;

  -- B: 3 mensajes, 150 s → 15 + 2 min × 2 = 19 XP; no avanza el streak.
  SELECT count(*) INTO v_n FROM public.sessions
  WHERE user_id = v_b AND group_session_id = v_gs AND kind = 'group' AND status = 'ended'
    AND duration_sec = 150 AND turns_count = 3 AND xp_earned = 19 AND ended_at IS NOT NULL;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'fila sessions de B incorrecta';
  END IF;
  SELECT xp, streak, last_session_day INTO v_xp, v_streak, v_day
  FROM public.profiles WHERE user_id = v_b;
  IF v_xp <> 19 OR v_streak <> 0 OR v_day IS NOT NULL THEN
    RAISE EXCEPTION 'B: xp 19 y streak intacto (xp=%, streak=%, day=%)', v_xp, v_streak, v_day;
  END IF;

  -- C: 6 mensajes, 600 s → 30 + 10 min × 2 = 50 XP; streak 0 → 1.
  SELECT count(*) INTO v_n FROM public.sessions
  WHERE user_id = v_c AND group_session_id = v_gs AND kind = 'group'
    AND turns_count = 6 AND xp_earned = 50;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'fila sessions de C incorrecta';
  END IF;
  SELECT xp, streak, last_session_day INTO v_xp, v_streak, v_day
  FROM public.profiles WHERE user_id = v_c;
  IF v_xp <> 50 OR v_streak <> 1 OR v_day <> v_today THEN
    RAISE EXCEPTION 'C: xp 50 y streak 1 hoy (xp=%, streak=%, day=%)', v_xp, v_streak, v_day;
  END IF;

  IF NOT v_res @> jsonb_build_array(
       jsonb_build_object('userId', v_b, 'xp', 19, 'streak', 0),
       jsonb_build_object('userId', v_c, 'xp', 50, 'streak', 1)) THEN
    RAISE EXCEPTION 'resultado inesperado: %', v_res;
  END IF;

  SELECT count(*) INTO v_n FROM public.xp_events
  WHERE user_id IN (v_b, v_c) AND kind = 'group';
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'debía haber un xp_event group por participante con mensajes, hay %', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.xp_events WHERE user_id = v_a;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'A no debía tener xp_events';
  END IF;

  -- =========================================================================
  -- 2. Idempotencia: la segunda llamada devuelve lo mismo y no duplica filas.
  -- =========================================================================
  v_res2 := public.close_group_session(v_gs, 'idle');
  IF v_res2 <> v_res THEN
    RAISE EXCEPTION 'el segundo cierre debía devolver lo mismo: % vs %', v_res2, v_res;
  END IF;
  SELECT count(*) INTO v_n FROM public.sessions WHERE group_session_id = v_gs;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'el segundo cierre no debía duplicar sessions, hay %', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.xp_events WHERE user_id IN (v_a, v_b, v_c);
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'el segundo cierre no debía duplicar xp_events, hay %', v_n;
  END IF;
  SELECT xp INTO v_xp FROM public.profiles WHERE user_id = v_c;
  IF v_xp <> 50 THEN
    RAISE EXCEPTION 'el segundo cierre no debía sumar XP, C tiene %', v_xp;
  END IF;
  SELECT count(*) INTO v_n FROM public.group_sessions
  WHERE id = v_gs AND end_reason = 'initiator';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'el segundo cierre no debía cambiar end_reason';
  END IF;

  -- =========================================================================
  -- 3. Topes: 20 mensajes (100 → 60) y 40 min (80 → 30) = 90 XP. Con streak 6
  --    desde ayer llega a 7 y suma el bonus streak_7 (40).
  -- =========================================================================
  UPDATE public.profiles SET xp = 0, streak = 6, longest_streak = 6,
                             last_session_day = v_today - 1
   WHERE user_id = v_c;

  INSERT INTO public.group_sessions (group_id, initiator_id, kind, topic)
  VALUES (v_group, v_c, 'free_topic', 'topes')
    RETURNING id INTO v_gs2;
  INSERT INTO public.group_session_participants
    (session_id, user_id, joined_at, left_at, present_sec, messages_count)
  VALUES (v_gs2, v_c, now() - interval '50 minutes', now() - interval '10 minutes', 2400, 20);

  v_res := public.close_group_session(v_gs2, 'max_duration');

  IF NOT v_res @> jsonb_build_array(jsonb_build_object('userId', v_c, 'xp', 130, 'streak', 7)) THEN
    RAISE EXCEPTION 'topes + streak_7: xp 90 + 40 y streak 7, dio %', v_res;
  END IF;
  SELECT amount INTO v_n FROM public.xp_events
  WHERE user_id = v_c AND kind = 'group'
    AND session_id = (SELECT id FROM public.sessions WHERE group_session_id = v_gs2);
  IF v_n <> 90 THEN
    RAISE EXCEPTION 'xp_event group con topes debía ser 90, es %', v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.xp_events
  WHERE user_id = v_c AND kind = 'streak_7' AND amount = 40;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'debía haber un xp_event streak_7 de 40, hay %', v_n;
  END IF;
  SELECT xp, longest_streak INTO v_xp, v_n FROM public.profiles WHERE user_id = v_c;
  IF v_xp <> 130 OR v_n <> 7 THEN
    RAISE EXCEPTION 'C: xp 130 y longest_streak 7 (xp=%, longest=%)', v_xp, v_n;
  END IF;

  -- =========================================================================
  -- Limpieza
  -- =========================================================================
  DELETE FROM public.xp_events WHERE user_id IN (v_a, v_b, v_c);
  DELETE FROM public.sessions  WHERE user_id IN (v_a, v_b, v_c);
  DELETE FROM public.profiles  WHERE user_id IN (v_a, v_b, v_c);
  DELETE FROM public.group_sessions WHERE id IN (v_gs, v_gs2);
  DELETE FROM public.groups WHERE id = v_group;

  RAISE NOTICE 'close_group_session: todas las comprobaciones en verde';
END;
$test$;
