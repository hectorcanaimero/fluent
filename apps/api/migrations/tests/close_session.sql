-- Test SQL de `close_session` (SPEC-01 §5, SPEC-07 §2, migración 3).
-- Ejecutar desde apps/api con:
--   ./scripts/run-sql-test.sh migrations/tests/close_session.sql
-- Requiere los usuarios de prueba: node scripts/db-test-users.ts
--
-- Cubre: sesión corta sin XP, sesión sin conversación, sesión válida con base
-- y duración, tope de duración, segunda sesión del día con bonus, tercera sin
-- bonus, cuarta sin XP, boss con multiplicador, bonus de desafío, streak de
-- ayer +1, streak roto = 1, gracia de la semana, bonus al llegar a 7 días e
-- idempotencia. Cualquier fallo lanza RAISE EXCEPTION.
--
-- El perfil de prueba usa timezone 'UTC' para que "hoy" sea determinista.

DO $test$
DECLARE
  v_user   uuid;
  v_other  uuid;
  v_sid    uuid;
  v_res    jsonb;
  v_today  date;
  v_monday date;
  v_xp     int;
  v_n      int;
  v_day    date;
BEGIN
  SELECT id INTO v_user  FROM auth.users WHERE email = 'sqltest-a@fluent.test';
  SELECT id INTO v_other FROM auth.users WHERE email = 'sqltest-b@fluent.test';
  IF v_user IS NULL OR v_other IS NULL THEN
    RAISE EXCEPTION 'faltan usuarios de prueba; ejecuta: node scripts/db-test-users.ts';
  END IF;

  v_today  := (now() AT TIME ZONE 'UTC')::date;
  v_monday := date_trunc('week', v_today::timestamp)::date;

  DELETE FROM public.xp_events WHERE user_id IN (v_user, v_other);
  DELETE FROM public.sessions  WHERE user_id IN (v_user, v_other);
  DELETE FROM public.profiles  WHERE user_id IN (v_user, v_other);
  INSERT INTO public.profiles (user_id, display_name, level, timezone, onboarded_at)
  VALUES (v_user, 'Test close_session', 'B1', 'UTC', now()),
         (v_other, 'Test retador', 'B1', 'UTC', now());

  -- =========================================================================
  -- 1. Sesión más corta que MIN_SESSION_SEC: sin XP y sin tocar el streak.
  -- =========================================================================
  INSERT INTO public.sessions (user_id, kind, topic) VALUES (v_user, 'free_topic', 'corta')
    RETURNING id INTO v_sid;
  v_res := public.close_session(v_sid, 120, 5);

  IF (v_res ->> 'xp_earned')::int <> 0 THEN
    RAISE EXCEPTION 'sesión corta no debía dar XP, dio %', v_res;
  END IF;
  IF (v_res ->> 'streak')::int <> 0 THEN
    RAISE EXCEPTION 'sesión corta no debía tocar el streak, dio %', v_res;
  END IF;

  SELECT sessions_count, last_session_day, xp INTO v_n, v_day, v_xp
  FROM public.profiles WHERE user_id = v_user;
  IF v_n <> 0 OR v_day IS NOT NULL OR v_xp <> 0 THEN
    RAISE EXCEPTION 'sesión corta no debía tocar el perfil (count=%, day=%, xp=%)', v_n, v_day, v_xp;
  END IF;

  SELECT count(*) INTO v_n FROM public.sessions WHERE id = v_sid AND status = 'ended' AND xp_earned = 0;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'la sesión corta debía quedar ended con xp_earned = 0';
  END IF;

  -- Menos de 2 turnos tampoco puntúa aunque dure lo suficiente.
  INSERT INTO public.sessions (user_id, kind, topic) VALUES (v_user, 'free_topic', 'sin turnos')
    RETURNING id INTO v_sid;
  v_res := public.close_session(v_sid, 600, 1);
  IF (v_res ->> 'xp_earned')::int <> 0 THEN
    RAISE EXCEPTION 'una sesión con menos de 2 turnos no debía dar XP, dio %', v_res;
  END IF;

  -- =========================================================================
  -- 2. Sesión válida: base 50 + duración (10 min → tope 30).
  -- =========================================================================
  DELETE FROM public.xp_events WHERE user_id = v_user;
  DELETE FROM public.sessions  WHERE user_id = v_user;
  UPDATE public.profiles SET xp = 0, streak = 0, longest_streak = 0,
         last_session_day = NULL, grace_used_week = NULL, sessions_count = 0
   WHERE user_id = v_user;

  INSERT INTO public.sessions (user_id, kind, topic) VALUES (v_user, 'free_topic', 'válida')
    RETURNING id INTO v_sid;
  v_res := public.close_session(v_sid, 600, 8);

  IF (v_res ->> 'xp_earned')::int <> 80 THEN
    RAISE EXCEPTION 'sesión de 10 min debía dar 50+30=80 XP, dio %', v_res;
  END IF;
  IF (v_res ->> 'streak')::int <> 1 OR (v_res ->> 'is_double_day')::boolean THEN
    RAISE EXCEPTION 'primera sesión: streak 1 y sin doble día, dio %', v_res;
  END IF;

  SELECT count(*) INTO v_n FROM public.xp_events
   WHERE session_id = v_sid AND kind = 'session' AND amount = 50;
  IF v_n <> 1 THEN RAISE EXCEPTION 'falta el evento session de 50 XP'; END IF;
  SELECT count(*) INTO v_n FROM public.xp_events
   WHERE session_id = v_sid AND kind = 'duration_bonus' AND amount = 30;
  IF v_n <> 1 THEN RAISE EXCEPTION 'falta el evento duration_bonus de 30 XP'; END IF;

  SELECT xp, sessions_count, last_session_day
    INTO v_xp, v_n, v_day FROM public.profiles WHERE user_id = v_user;
  IF v_xp <> 80 OR v_n <> 1 OR v_day <> v_today THEN
    RAISE EXCEPTION 'el perfil debía quedar con 80 XP, 1 sesión y last_session_day = hoy (xp=%, count=%, day=%)',
      v_xp, v_n, v_day;
  END IF;
  SELECT longest_streak INTO v_n FROM public.profiles WHERE user_id = v_user;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'longest_streak debía subir a 1, quedó en %', v_n;
  END IF;

  -- Una sesión de justo 5 minutos no cobra duración.
  DELETE FROM public.xp_events WHERE user_id = v_user;
  DELETE FROM public.sessions  WHERE user_id = v_user;
  UPDATE public.profiles SET xp = 0, streak = 0, longest_streak = 0,
         last_session_day = NULL, grace_used_week = NULL, sessions_count = 0
   WHERE user_id = v_user;

  INSERT INTO public.sessions (user_id, kind, topic) VALUES (v_user, 'free_topic', 'cinco minutos')
    RETURNING id INTO v_sid;
  v_res := public.close_session(v_sid, 300, 4);
  IF (v_res ->> 'xp_earned')::int <> 50 THEN
    RAISE EXCEPTION 'sesión de 5 min debía dar solo la base (50), dio %', v_res;
  END IF;

  -- Y una de 20 minutos no pasa del tope de 30.
  INSERT INTO public.sessions (user_id, kind, topic) VALUES (v_user, 'free_topic', 'veinte minutos')
    RETURNING id INTO v_sid;
  v_res := public.close_session(v_sid, 1200, 12);
  IF (v_res ->> 'xp_earned')::int <> 105 THEN
    RAISE EXCEPTION 'segunda sesión de 20 min: 50+30+25=105, dio %', v_res;
  END IF;

  -- =========================================================================
  -- 3. Segunda, tercera y cuarta sesión del día.
  -- =========================================================================
  DELETE FROM public.xp_events WHERE user_id = v_user;
  DELETE FROM public.sessions  WHERE user_id = v_user;
  UPDATE public.profiles SET xp = 0, streak = 0, longest_streak = 0,
         last_session_day = NULL, grace_used_week = NULL, sessions_count = 0
   WHERE user_id = v_user;

  INSERT INTO public.sessions (user_id, kind, topic) VALUES (v_user, 'free_topic', 'día 1')
    RETURNING id INTO v_sid;
  v_res := public.close_session(v_sid, 600, 8);
  IF (v_res ->> 'xp_earned')::int <> 80 THEN
    RAISE EXCEPTION 'primera del día: 80 XP, dio %', v_res;
  END IF;

  INSERT INTO public.sessions (user_id, kind, topic) VALUES (v_user, 'free_topic', 'día 2')
    RETURNING id INTO v_sid;
  v_res := public.close_session(v_sid, 600, 8);
  IF (v_res ->> 'xp_earned')::int <> 105 OR NOT (v_res ->> 'is_double_day')::boolean THEN
    RAISE EXCEPTION 'segunda del día: 105 XP y is_double_day, dio %', v_res;
  END IF;
  SELECT count(*) INTO v_n FROM public.xp_events
   WHERE session_id = v_sid AND kind = 'double_day' AND amount = 25;
  IF v_n <> 1 THEN RAISE EXCEPTION 'falta el evento double_day'; END IF;

  INSERT INTO public.sessions (user_id, kind, topic) VALUES (v_user, 'free_topic', 'día 3')
    RETURNING id INTO v_sid;
  v_res := public.close_session(v_sid, 600, 8);
  IF (v_res ->> 'xp_earned')::int <> 80 OR (v_res ->> 'is_double_day')::boolean THEN
    RAISE EXCEPTION 'tercera del día: 80 XP y sin doble día, dio %', v_res;
  END IF;

  INSERT INTO public.sessions (user_id, kind, topic) VALUES (v_user, 'free_topic', 'día 4')
    RETURNING id INTO v_sid;
  v_res := public.close_session(v_sid, 600, 8);
  IF (v_res ->> 'xp_earned')::int <> 0 THEN
    RAISE EXCEPTION 'la cuarta sesión del día no debía dar XP, dio %', v_res;
  END IF;
  IF (v_res ->> 'streak')::int <> 1 THEN
    RAISE EXCEPTION 'la cuarta sesión sí cuenta para el streak, dio %', v_res;
  END IF;

  SELECT xp, sessions_count INTO v_xp, v_n FROM public.profiles WHERE user_id = v_user;
  IF v_xp <> 265 OR v_n <> 4 THEN
    RAISE EXCEPTION 'tras cuatro sesiones: 80+105+80+0 = 265 XP y sessions_count 4 (xp=%, count=%)', v_xp, v_n;
  END IF;

  -- =========================================================================
  -- 4. Boss: multiplicador sobre base y duración.
  -- =========================================================================
  DELETE FROM public.xp_events WHERE user_id = v_user;
  DELETE FROM public.sessions  WHERE user_id = v_user;
  UPDATE public.profiles SET xp = 0, streak = 0, longest_streak = 0,
         last_session_day = NULL, grace_used_week = NULL, sessions_count = 0
   WHERE user_id = v_user;

  INSERT INTO public.sessions (user_id, kind, topic) VALUES (v_user, 'boss', 'ética de la IA')
    RETURNING id INTO v_sid;
  v_res := public.close_session(v_sid, 600, 8);
  IF (v_res ->> 'xp_earned')::int <> 160 THEN
    RAISE EXCEPTION 'boss de 10 min: (50+30)*2 = 160 XP, dio %', v_res;
  END IF;

  -- =========================================================================
  -- 5. Bonus de desafío cruzado.
  -- =========================================================================
  DELETE FROM public.xp_events WHERE user_id = v_user;
  DELETE FROM public.sessions  WHERE user_id = v_user;
  UPDATE public.profiles SET xp = 0, streak = 0, longest_streak = 0,
         last_session_day = NULL, grace_used_week = NULL, sessions_count = 0
   WHERE user_id = v_user;

  INSERT INTO public.sessions (user_id, kind, topic, challenge_from_user_id)
  VALUES (v_user, 'free_topic', 'desafío', v_other) RETURNING id INTO v_sid;
  v_res := public.close_session(v_sid, 600, 8);
  IF (v_res ->> 'xp_earned')::int <> 95 THEN
    RAISE EXCEPTION 'sesión de desafío: 50+30+15 = 95 XP, dio %', v_res;
  END IF;
  SELECT count(*) INTO v_n FROM public.xp_events
   WHERE session_id = v_sid AND kind = 'challenge' AND amount = 15;
  IF v_n <> 1 THEN RAISE EXCEPTION 'falta el evento challenge'; END IF;

  -- =========================================================================
  -- 6. Streak: ayer +1, roto = 1, gracia y bonus de los 7 días.
  -- =========================================================================
  DELETE FROM public.xp_events WHERE user_id = v_user;
  DELETE FROM public.sessions  WHERE user_id = v_user;
  UPDATE public.profiles SET xp = 0, streak = 3, longest_streak = 3,
         last_session_day = v_today - 1, grace_used_week = NULL, sessions_count = 0
   WHERE user_id = v_user;

  INSERT INTO public.sessions (user_id, kind, topic) VALUES (v_user, 'free_topic', 'ayer +1')
    RETURNING id INTO v_sid;
  v_res := public.close_session(v_sid, 600, 8);
  IF (v_res ->> 'streak')::int <> 4 THEN
    RAISE EXCEPTION 'practicar tras haber practicado ayer: streak 4, dio %', v_res;
  END IF;

  -- streak roto
  DELETE FROM public.xp_events WHERE user_id = v_user;
  DELETE FROM public.sessions  WHERE user_id = v_user;
  UPDATE public.profiles SET xp = 0, streak = 9, longest_streak = 9,
         last_session_day = v_today - 5, grace_used_week = NULL, sessions_count = 0
   WHERE user_id = v_user;

  INSERT INTO public.sessions (user_id, kind, topic) VALUES (v_user, 'free_topic', 'streak roto')
    RETURNING id INTO v_sid;
  v_res := public.close_session(v_sid, 600, 8);
  IF (v_res ->> 'streak')::int <> 1 THEN
    RAISE EXCEPTION 'tras cinco días sin practicar el streak vuelve a 1, dio %', v_res;
  END IF;
  SELECT longest_streak INTO v_n FROM public.profiles WHERE user_id = v_user;
  IF v_n <> 9 THEN
    RAISE EXCEPTION 'longest_streak no debía bajar de 9, quedó en %', v_n;
  END IF;

  -- anteayer con la gracia de la semana ya aplicada por el job
  DELETE FROM public.xp_events WHERE user_id = v_user;
  DELETE FROM public.sessions  WHERE user_id = v_user;
  UPDATE public.profiles SET xp = 0, streak = 4, longest_streak = 4,
         last_session_day = v_today - 2, grace_used_week = v_monday, sessions_count = 0
   WHERE user_id = v_user;

  INSERT INTO public.sessions (user_id, kind, topic) VALUES (v_user, 'free_topic', 'con gracia')
    RETURNING id INTO v_sid;
  v_res := public.close_session(v_sid, 600, 8);
  IF (v_res ->> 'streak')::int <> 5 THEN
    RAISE EXCEPTION 'con la gracia usada esta semana el streak sube a 5, dio %', v_res;
  END IF;

  -- anteayer sin gracia: el streak se rompe
  DELETE FROM public.xp_events WHERE user_id = v_user;
  DELETE FROM public.sessions  WHERE user_id = v_user;
  UPDATE public.profiles SET xp = 0, streak = 4, longest_streak = 4,
         last_session_day = v_today - 2, grace_used_week = NULL, sessions_count = 0
   WHERE user_id = v_user;

  INSERT INTO public.sessions (user_id, kind, topic) VALUES (v_user, 'free_topic', 'sin gracia')
    RETURNING id INTO v_sid;
  v_res := public.close_session(v_sid, 600, 8);
  IF (v_res ->> 'streak')::int <> 1 THEN
    RAISE EXCEPTION 'sin gracia, anteayer rompe el streak, dio %', v_res;
  END IF;

  -- bonus al llegar a 7
  DELETE FROM public.xp_events WHERE user_id = v_user;
  DELETE FROM public.sessions  WHERE user_id = v_user;
  UPDATE public.profiles SET xp = 0, streak = 6, longest_streak = 6,
         last_session_day = v_today - 1, grace_used_week = NULL, sessions_count = 0
   WHERE user_id = v_user;

  INSERT INTO public.sessions (user_id, kind, topic) VALUES (v_user, 'free_topic', 'séptimo día')
    RETURNING id INTO v_sid;
  v_res := public.close_session(v_sid, 600, 8);
  IF (v_res ->> 'streak')::int <> 7 OR (v_res ->> 'xp_earned')::int <> 120 THEN
    RAISE EXCEPTION 'al llegar a 7 días: streak 7 y 80+40 = 120 XP, dio %', v_res;
  END IF;
  SELECT count(*) INTO v_n FROM public.xp_events
   WHERE session_id = v_sid AND kind = 'streak_7' AND amount = 40;
  IF v_n <> 1 THEN RAISE EXCEPTION 'falta el evento streak_7'; END IF;

  -- la segunda sesión del mismo día no vuelve a cobrar el bonus de los 7 días
  INSERT INTO public.sessions (user_id, kind, topic) VALUES (v_user, 'free_topic', 'séptimo día, 2ª')
    RETURNING id INTO v_sid;
  v_res := public.close_session(v_sid, 600, 8);
  IF (v_res ->> 'xp_earned')::int <> 105 THEN
    RAISE EXCEPTION 'la segunda del día con streak 7 debía dar 105, dio %', v_res;
  END IF;

  -- =========================================================================
  -- 7. next_is_boss e idempotencia.
  -- =========================================================================
  DELETE FROM public.xp_events WHERE user_id = v_user;
  DELETE FROM public.sessions  WHERE user_id = v_user;
  UPDATE public.profiles SET xp = 0, streak = 0, longest_streak = 0,
         last_session_day = NULL, grace_used_week = NULL, sessions_count = 5
   WHERE user_id = v_user;

  INSERT INTO public.sessions (user_id, kind, topic) VALUES (v_user, 'free_topic', 'sexta')
    RETURNING id INTO v_sid;
  v_res := public.close_session(v_sid, 600, 8);
  IF NOT (v_res ->> 'next_is_boss')::boolean THEN
    RAISE EXCEPTION 'con sessions_count = 6 la siguiente debía ser boss, dio %', v_res;
  END IF;

  -- cerrar dos veces no vuelve a puntuar
  v_res := public.close_session(v_sid, 600, 8);
  IF (v_res ->> 'xp_earned')::int <> 80 THEN
    RAISE EXCEPTION 'el segundo cierre debía devolver el XP ya concedido, dio %', v_res;
  END IF;
  SELECT xp, sessions_count INTO v_xp, v_n FROM public.profiles WHERE user_id = v_user;
  IF v_xp <> 80 OR v_n <> 6 THEN
    RAISE EXCEPTION 'cerrar dos veces no debía duplicar nada (xp=%, count=%)', v_xp, v_n;
  END IF;
  SELECT count(*) INTO v_n FROM public.xp_events WHERE session_id = v_sid;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'cerrar dos veces no debía duplicar los xp_events, hay %', v_n;
  END IF;

  -- =========================================================================
  -- Limpieza
  -- =========================================================================
  DELETE FROM public.xp_events WHERE user_id IN (v_user, v_other);
  DELETE FROM public.sessions  WHERE user_id IN (v_user, v_other);
  DELETE FROM public.profiles  WHERE user_id IN (v_user, v_other);

  RAISE NOTICE 'close_session: todas las comprobaciones en verde';
END;
$test$;
