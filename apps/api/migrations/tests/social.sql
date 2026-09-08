-- Test SQL de la migración 5: `weekly_leaderboard`, `apply_streak_grace` y
-- `update_group_streaks` (SPEC-01 §5, SPEC-07 §5 y §6, SPEC-05 §6).
-- Ejecutar desde apps/api con:
--   ./scripts/run-sql-test.sh migrations/tests/social.sql
-- Requiere los usuarios de prueba: node scripts/db-test-users.ts
--
-- Cubre:
--   - weekly_leaderboard: empate de XP resuelto por más sesiones; un tercer
--     miembro con 0 XP al final; los xp_events fuera de la ventana (antes del
--     lunes o desde el lunes siguiente) no cuentan.
--   - apply_streak_grace: gracia concedida a quien practicó anteayer, streak
--     intacto y grace_used_week = lunes; una segunda ejecución el mismo día
--     no vuelve a tocarlo; practicar hace 5 días deja streak 0; practicar
--     ayer no toca nada; ya haber usado la gracia esta semana y fallar otra
--     vez deja streak 0.
--   - update_group_streaks: grupo con activos que practicaron ayer/hoy sube
--     group_streak; un miembro inactivo (>14 días) no bloquea al grupo; un
--     activo que no practicó ayer lo pone a 0; segunda ejecución el mismo
--     día no lo vuelve a subir (columna group_streak_day, pendientes/PR-01 §25).
--
-- Perfiles con timezone = 'UTC' para que "hoy"/"ayer"/"anteayer" sean
-- deterministas. `current_date` se lee aparte porque puede no coincidir con
-- la zona UTC de los perfiles si la sesión de Postgres usa otra zona.

DO $test$
DECLARE
  v_a uuid; v_b uuid; v_c uuid; v_d uuid;
  v_group1 uuid;
  v_group2 uuid;
  v_today  date;   -- hoy en UTC (zona de los perfiles de prueba)
  v_monday date;
  v_admin_today date; -- current_date de la sesión de Postgres
  v_res   jsonb;
  v_lb    jsonb;
  v_n     int;
  v_streak int;
  v_grace  date;
  v_day    date;
  v_gs     int;
  v_gsd    date;
BEGIN
  SELECT id INTO v_a FROM auth.users WHERE email = 'sqltest-a@fluent.test';
  SELECT id INTO v_b FROM auth.users WHERE email = 'sqltest-b@fluent.test';
  SELECT id INTO v_c FROM auth.users WHERE email = 'sqltest-c@fluent.test';
  SELECT id INTO v_d FROM auth.users WHERE email = 'sqltest-d@fluent.test';
  IF v_a IS NULL OR v_b IS NULL OR v_c IS NULL OR v_d IS NULL THEN
    RAISE EXCEPTION 'faltan usuarios de prueba; ejecuta: node scripts/db-test-users.ts';
  END IF;

  v_today       := (now() AT TIME ZONE 'UTC')::date;
  v_monday      := date_trunc('week', v_today::timestamp)::date;
  v_admin_today := current_date;

  -- ---- estado limpio (por si un run anterior falló a medias) --------------
  DELETE FROM public.xp_events WHERE user_id IN (v_a, v_b, v_c, v_d);
  DELETE FROM public.sessions  WHERE user_id IN (v_a, v_b, v_c, v_d);
  DELETE FROM public.profiles  WHERE user_id IN (v_a, v_b, v_c, v_d);
  DELETE FROM public.groups    WHERE name IN ('SQLTEST social leaderboard', 'SQLTEST social streak');

  -- =========================================================================
  -- 1. weekly_leaderboard (SPEC-01 §5, SPEC-07 §5)
  -- =========================================================================
  INSERT INTO public.groups (name) VALUES ('SQLTEST social leaderboard') RETURNING id INTO v_group1;

  INSERT INTO public.profiles (user_id, group_id, display_name, level, timezone, onboarded_at)
  VALUES (v_a, v_group1, 'Leader A', 'B1', 'UTC', now()),
         (v_b, v_group1, 'Leader B', 'B1', 'UTC', now()),
         (v_c, v_group1, 'Leader C', 'B1', 'UTC', now());

  -- A: 100 XP esta semana (2 sesiones válidas).
  INSERT INTO public.xp_events (user_id, kind, amount) VALUES
    (v_a, 'session', 50), (v_a, 'session', 50);
  -- Fuera de ventana: la semana pasada. No debe sumar.
  INSERT INTO public.xp_events (user_id, kind, amount, created_at)
  VALUES (v_a, 'session', 500, (v_monday - 1)::timestamptz);

  INSERT INTO public.sessions (user_id, kind, topic, status, ended_at, xp_earned, turns_count)
  VALUES (v_a, 'free_topic', 'lb-a-1', 'ended', now(), 80, 8),
         (v_a, 'free_topic', 'lb-a-2', 'ended', now(), 80, 8);

  -- B: también 100 XP, pero con más sesiones (desempate).
  INSERT INTO public.xp_events (user_id, kind, amount) VALUES
    (v_b, 'session', 50), (v_b, 'session', 50);
  -- Fuera de ventana: justo la semana siguiente (límite superior exclusivo).
  INSERT INTO public.xp_events (user_id, kind, amount, created_at)
  VALUES (v_b, 'session', 500, (v_monday + 7)::timestamptz);

  INSERT INTO public.sessions (user_id, kind, topic, status, ended_at, xp_earned, turns_count)
  VALUES (v_b, 'free_topic', 'lb-b-1', 'ended', now(), 60, 8),
         (v_b, 'free_topic', 'lb-b-2', 'ended', now(), 60, 8),
         (v_b, 'free_topic', 'lb-b-3', 'ended', now(), 60, 8);

  -- C: sin XP ni sesiones válidas esta semana.

  v_lb := public.weekly_leaderboard(v_group1, v_monday);

  IF jsonb_array_length(v_lb) <> 3 THEN
    RAISE EXCEPTION 'el leaderboard debía tener 3 miembros, dio %', v_lb;
  END IF;

  IF (v_lb -> 0 ->> 'user_id') <> v_b::text
     OR (v_lb -> 0 ->> 'xp')::int <> 100
     OR (v_lb -> 0 ->> 'sessions')::int <> 3
     OR (v_lb -> 0 ->> 'rank')::int <> 1 THEN
    RAISE EXCEPTION 'primer puesto debía ser B (100 XP, 3 sesiones, rank 1), dio %', v_lb -> 0;
  END IF;

  IF (v_lb -> 1 ->> 'user_id') <> v_a::text
     OR (v_lb -> 1 ->> 'xp')::int <> 100
     OR (v_lb -> 1 ->> 'sessions')::int <> 2
     OR (v_lb -> 1 ->> 'rank')::int <> 2 THEN
    RAISE EXCEPTION 'segundo puesto debía ser A (100 XP, 2 sesiones, rank 2; el empate lo rompen las sesiones), dio %', v_lb -> 1;
  END IF;

  IF (v_lb -> 2 ->> 'user_id') <> v_c::text
     OR (v_lb -> 2 ->> 'xp')::int <> 0
     OR (v_lb -> 2 ->> 'sessions')::int <> 0
     OR (v_lb -> 2 ->> 'rank')::int <> 3 THEN
    RAISE EXCEPTION 'tercer puesto debía ser C con 0 XP al final, dio %', v_lb -> 2;
  END IF;

  DELETE FROM public.xp_events WHERE user_id IN (v_a, v_b, v_c);
  DELETE FROM public.sessions  WHERE user_id IN (v_a, v_b, v_c);
  DELETE FROM public.profiles  WHERE user_id IN (v_a, v_b, v_c);
  DELETE FROM public.groups    WHERE id = v_group1;

  -- =========================================================================
  -- 2. apply_streak_grace (SPEC-05 §6 paso 1, SPEC-07 §3)
  -- =========================================================================
  INSERT INTO public.profiles (user_id, display_name, level, timezone, onboarded_at,
                                streak, longest_streak, last_session_day, grace_used_week)
  VALUES
    -- A: practicó anteayer, sin gracia usada esta semana → recibe la gracia.
    (v_a, 'Grace A', 'B1', 'UTC', now(), 5, 5, v_today - 2, NULL),
    -- B: practicó hace 5 días → streak a 0.
    (v_b, 'Grace B', 'B1', 'UTC', now(), 9, 9, v_today - 5, NULL),
    -- C: practicó ayer → no se toca.
    (v_c, 'Grace C', 'B1', 'UTC', now(), 3, 3, v_today - 1, NULL),
    -- D: ya usó la gracia esta semana y vuelve a fallar (no fue anteayer) → streak a 0.
    (v_d, 'Grace D', 'B1', 'UTC', now(), 7, 7, v_today - 4, v_monday);

  v_res := public.apply_streak_grace();

  IF (v_res ->> 'graced')::int < 1 THEN
    RAISE EXCEPTION 'apply_streak_grace debía conceder al menos una gracia, dio %', v_res;
  END IF;
  IF (v_res ->> 'reset')::int < 2 THEN
    RAISE EXCEPTION 'apply_streak_grace debía resetear al menos dos streaks (B y D), dio %', v_res;
  END IF;

  SELECT streak, grace_used_week INTO v_streak, v_grace FROM public.profiles WHERE user_id = v_a;
  IF v_streak <> 5 OR v_grace <> v_monday THEN
    RAISE EXCEPTION 'A debía conservar streak 5 y grace_used_week = lunes, dio streak=%, grace=%', v_streak, v_grace;
  END IF;

  SELECT streak INTO v_streak FROM public.profiles WHERE user_id = v_b;
  IF v_streak <> 0 THEN
    RAISE EXCEPTION 'B (practicó hace 5 días) debía quedar con streak 0, dio %', v_streak;
  END IF;

  SELECT streak, last_session_day INTO v_streak, v_day FROM public.profiles WHERE user_id = v_c;
  IF v_streak <> 3 OR v_day <> v_today - 1 THEN
    RAISE EXCEPTION 'C (practicó ayer) no debía tocarse, dio streak=%, last_session_day=%', v_streak, v_day;
  END IF;

  SELECT streak INTO v_streak FROM public.profiles WHERE user_id = v_d;
  IF v_streak <> 0 THEN
    RAISE EXCEPTION 'D (gracia ya usada esta semana, vuelve a fallar) debía quedar con streak 0, dio %', v_streak;
  END IF;

  -- Segunda ejecución el mismo día: a A no se le vuelve a tocar el streak
  -- (idempotencia; sin esta rama, apply_streak_grace le pondría el streak a
  -- 0 justo después de haberle concedido la gracia. Ver pendientes/PR-01 §24).
  v_res := public.apply_streak_grace();

  SELECT streak, grace_used_week INTO v_streak, v_grace FROM public.profiles WHERE user_id = v_a;
  IF v_streak <> 5 OR v_grace <> v_monday THEN
    RAISE EXCEPTION 'la segunda ejecución el mismo día no debía tocar a A, dio streak=%, grace=%', v_streak, v_grace;
  END IF;

  DELETE FROM public.profiles WHERE user_id IN (v_a, v_b, v_c, v_d);

  -- =========================================================================
  -- 3. update_group_streaks (SPEC-05 §6 paso 2, SPEC-07 §6, pendientes/PR-01 §25)
  -- =========================================================================
  INSERT INTO public.groups (name) VALUES ('SQLTEST social streak') RETURNING id INTO v_group2;

  -- A y B: activos, practicaron ayer y hoy respectivamente.
  INSERT INTO public.profiles (user_id, group_id, display_name, level, timezone,
                                onboarded_at, last_session_day)
  VALUES
    (v_a, v_group2, 'Streak A', 'B1', 'UTC', now(), v_today - 1),
    (v_b, v_group2, 'Streak B', 'B1', 'UTC', now(), v_today);

  v_res := public.update_group_streaks();

  SELECT group_streak, group_streak_day INTO v_gs, v_gsd FROM public.groups WHERE id = v_group2;
  IF v_gs <> 1 OR v_gsd <> v_admin_today THEN
    RAISE EXCEPTION 'con A y B activos al día, group_streak debía subir a 1 (día %), dio streak=%, day=%',
      v_admin_today, v_gs, v_gsd;
  END IF;
  IF (v_res ->> 'advanced')::int < 1 THEN
    RAISE EXCEPTION 'update_group_streaks debía avanzar al menos un grupo, dio %', v_res;
  END IF;

  -- C se une, inactivo desde hace más de 14 días: no debe bloquear al grupo.
  -- Se simula "el día siguiente" reabriendo group_streak_day.
  UPDATE public.groups SET group_streak_day = NULL WHERE id = v_group2;
  INSERT INTO public.profiles (user_id, group_id, display_name, level, timezone,
                                onboarded_at, last_session_day)
  VALUES (v_c, v_group2, 'Streak C inactiva', 'B1', 'UTC', now(), v_today - 20);

  v_res := public.update_group_streaks();

  SELECT group_streak, group_streak_day INTO v_gs, v_gsd FROM public.groups WHERE id = v_group2;
  IF v_gs <> 2 OR v_gsd <> v_admin_today THEN
    RAISE EXCEPTION 'un miembro inactivo (>14 días) no debía bloquear el avance a 2, dio streak=%, day=%', v_gs, v_gsd;
  END IF;

  -- B deja de practicar ayer (sigue activo, dentro de 14 días): reset a 0.
  UPDATE public.groups SET group_streak_day = NULL WHERE id = v_group2;
  UPDATE public.profiles SET last_session_day = v_today - 3 WHERE user_id = v_b;

  v_res := public.update_group_streaks();

  SELECT group_streak, group_streak_day INTO v_gs, v_gsd FROM public.groups WHERE id = v_group2;
  IF v_gs <> 0 OR v_gsd <> v_admin_today THEN
    RAISE EXCEPTION 'un activo que no practicó ayer debía resetear el grupo a 0, dio streak=%, day=%', v_gs, v_gsd;
  END IF;

  -- Segunda ejecución el mismo día: no lo vuelve a mover.
  v_res := public.update_group_streaks();

  SELECT group_streak, group_streak_day INTO v_gs, v_gsd FROM public.groups WHERE id = v_group2;
  IF v_gs <> 0 OR v_gsd <> v_admin_today THEN
    RAISE EXCEPTION 'la segunda ejecución el mismo día no debía tocar el grupo, dio streak=%, day=%', v_gs, v_gsd;
  END IF;
  IF (v_res ->> 'skipped')::int < 1 THEN
    RAISE EXCEPTION 'la segunda ejecución debía saltarse al menos el grupo ya actualizado hoy, dio %', v_res;
  END IF;

  -- =========================================================================
  -- Limpieza
  -- =========================================================================
  DELETE FROM public.xp_events WHERE user_id IN (v_a, v_b, v_c, v_d);
  DELETE FROM public.sessions  WHERE user_id IN (v_a, v_b, v_c, v_d);
  DELETE FROM public.profiles  WHERE user_id IN (v_a, v_b, v_c, v_d);
  DELETE FROM public.groups    WHERE id IN (v_group1, v_group2);

  RAISE NOTICE 'social: todas las comprobaciones en verde';
END;
$test$;
