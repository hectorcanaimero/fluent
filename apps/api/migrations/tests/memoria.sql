-- Test SQL de la migración 4: `pick_callback_fact` y `apply_brief`
-- (SPEC-01 §2.9, §2.10, §5 y SPEC-05 §2 paso 4).
-- Ejecutar desde apps/api con:
--   ./scripts/run-sql-test.sh migrations/tests/memoria.sql
-- Requiere los usuarios de prueba: node scripts/db-test-users.ts
--
-- Cubre: pick_callback_fact no devuelve el mismo hecho dos veces seguidas,
-- prioriza el `happens_on` más próximo, ignora los `pending` y los
-- `dismissed`, marca `last_used_at`/`use_count` y devuelve NULL sin
-- candidatos; apply_brief archiva el brief anterior, no duplica hechos con la
-- misma cadena normalizada, recorta el brief a 600 caracteres y los errores
-- recurrentes a 5, y es idempotente.

DO $test$
DECLARE
  v_user   uuid;
  v_sid1   uuid;
  v_sid2   uuid;
  v_sid3   uuid;
  v_f1     uuid;   -- confirmado, sin fecha
  v_f2     uuid;   -- confirmado, fecha mañana
  v_f3     uuid;   -- pendiente
  v_f4     uuid;   -- confirmado, fecha dentro de 30 días
  v_f5     uuid;   -- descartado
  v_pick   jsonb;
  v_prev   uuid;
  v_n      int;
  v_txt    text;
BEGIN
  SELECT id INTO v_user FROM auth.users WHERE email = 'sqltest-a@fluent.test';
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'faltan usuarios de prueba; ejecuta: node scripts/db-test-users.ts';
  END IF;

  -- ---- estado limpio ------------------------------------------------------
  DELETE FROM public.coaching_brief_history WHERE user_id = v_user;
  DELETE FROM public.coaching_briefs WHERE user_id = v_user;
  DELETE FROM public.facts WHERE user_id = v_user;
  DELETE FROM public.xp_events WHERE user_id = v_user;
  DELETE FROM public.sessions WHERE user_id = v_user;
  DELETE FROM public.profiles WHERE user_id = v_user;
  INSERT INTO public.profiles (user_id, display_name, level, timezone, onboarded_at)
  VALUES (v_user, 'Test memoria', 'B1', 'UTC', now());

  INSERT INTO public.sessions (user_id, kind, topic) VALUES (v_user, 'free_topic', 'sesión 1')
    RETURNING id INTO v_sid1;
  INSERT INTO public.sessions (user_id, kind, topic) VALUES (v_user, 'free_topic', 'sesión 2')
    RETURNING id INTO v_sid2;
  INSERT INTO public.sessions (user_id, kind, topic) VALUES (v_user, 'free_topic', 'sesión 3')
    RETURNING id INTO v_sid3;

  -- =========================================================================
  -- 1. pick_callback_fact sin hechos confirmados → NULL
  -- =========================================================================
  INSERT INTO public.facts (user_id, text, status) VALUES (v_user, 'Likes football', 'pending')
    RETURNING id INTO v_f3;
  INSERT INTO public.facts (user_id, text, status) VALUES (v_user, 'Hates mornings', 'dismissed')
    RETURNING id INTO v_f5;

  IF public.pick_callback_fact(v_user) IS NOT NULL THEN
    RAISE EXCEPTION 'sin hechos confirmados pick_callback_fact debía devolver NULL';
  END IF;

  -- =========================================================================
  -- 2. Prioriza el happens_on más próximo e ignora pending y dismissed
  -- =========================================================================
  INSERT INTO public.facts (user_id, text, status) VALUES
    (v_user, 'Works as a designer', 'confirmed') RETURNING id INTO v_f1;
  INSERT INTO public.facts (user_id, text, happens_on, status) VALUES
    (v_user, 'Has a job interview', current_date + 1, 'confirmed') RETURNING id INTO v_f2;
  INSERT INTO public.facts (user_id, text, happens_on, status) VALUES
    (v_user, 'Travels to Lisbon', current_date + 30, 'confirmed') RETURNING id INTO v_f4;

  v_pick := public.pick_callback_fact(v_user);
  IF (v_pick ->> 'id')::uuid <> v_f2 THEN
    RAISE EXCEPTION 'debía elegir el hecho con happens_on más próximo, eligió %', v_pick ->> 'text';
  END IF;
  IF (v_pick ->> 'use_count')::int <> 1 OR (v_pick ->> 'last_used_at') IS NULL THEN
    RAISE EXCEPTION 'pick_callback_fact debía marcar last_used_at y use_count, dio %', v_pick;
  END IF;

  -- =========================================================================
  -- 3. Nunca el mismo hecho dos veces seguidas
  -- =========================================================================
  v_prev := v_f2;
  FOR v_n IN 1..6 LOOP
    v_pick := public.pick_callback_fact(v_user);
    IF v_pick IS NULL THEN
      RAISE EXCEPTION 'pick_callback_fact devolvió NULL habiendo hechos confirmados';
    END IF;
    IF (v_pick ->> 'id')::uuid = v_prev THEN
      RAISE EXCEPTION 'pick_callback_fact repitió el mismo hecho dos veces seguidas';
    END IF;
    IF (v_pick ->> 'id')::uuid IN (v_f3, v_f5) THEN
      RAISE EXCEPTION 'pick_callback_fact no debía elegir un hecho pending ni dismissed';
    END IF;
    v_prev := (v_pick ->> 'id')::uuid;
  END LOOP;

  -- Con un único hecho confirmado sí puede repetirlo.
  UPDATE public.facts SET status = 'dismissed' WHERE id IN (v_f2, v_f4);
  v_pick := public.pick_callback_fact(v_user);
  IF (v_pick ->> 'id')::uuid <> v_f1 THEN
    RAISE EXCEPTION 'con un solo hecho confirmado debía devolverlo, dio %', v_pick;
  END IF;
  v_pick := public.pick_callback_fact(v_user);
  IF (v_pick ->> 'id')::uuid <> v_f1 THEN
    RAISE EXCEPTION 'con un solo candidato debe poder repetirlo, dio %', v_pick;
  END IF;

  -- =========================================================================
  -- 4. apply_brief: brief, hechos pendientes y cierre del job
  -- =========================================================================
  DELETE FROM public.facts WHERE user_id = v_user;

  v_pick := public.apply_brief(
    v_sid1,
    'Push the learner to use the past simple; they avoid it.',
    'B1',
    '[{"category":"past_simple","example":"I go yesterday"}]'::jsonb,
    '[{"text":"Has a job interview","happens_on":"2026-09-12"},
       {"text":"Works as a designer"}]'::jsonb
  );

  IF NOT (v_pick ->> 'applied')::boolean OR (v_pick ->> 'facts_inserted')::int <> 2 THEN
    RAISE EXCEPTION 'apply_brief debía insertar 2 hechos, dio %', v_pick;
  END IF;

  SELECT count(*) INTO v_n FROM public.facts
   WHERE user_id = v_user AND status = 'pending' AND source_session_id = v_sid1;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'los hechos nuevos debían quedar pending y ligados a la sesión, hay %', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM public.facts
   WHERE user_id = v_user AND happens_on = DATE '2026-09-12';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'apply_brief debía guardar el happens_on del hecho';
  END IF;

  SELECT count(*) INTO v_n FROM public.sessions
   WHERE id = v_sid1 AND brief_job_status = 'done';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'apply_brief debía marcar la sesión como done';
  END IF;

  -- idempotencia: repetir la llamada no vuelve a insertar
  v_pick := public.apply_brief(v_sid1, 'otro brief', 'B2', '[]'::jsonb, '[]'::jsonb);
  IF (v_pick ->> 'applied')::boolean THEN
    RAISE EXCEPTION 'apply_brief sobre una sesión ya done no debía aplicarse, dio %', v_pick;
  END IF;
  SELECT text INTO v_txt FROM public.coaching_briefs WHERE user_id = v_user;
  IF v_txt <> 'Push the learner to use the past simple; they avoid it.' THEN
    RAISE EXCEPTION 'el brief no debía cambiar en la llamada idempotente, quedó "%"', v_txt;
  END IF;

  -- =========================================================================
  -- 5. No duplica hechos con la misma cadena normalizada
  -- =========================================================================
  v_pick := public.apply_brief(
    v_sid2,
    'Second brief: keep pushing the past simple.',
    'B1',
    '[]'::jsonb,
    '[{"text":"  HAS a job, interview!! "},
       {"text":"Plays the guitar"},
       {"text":"plays the guitar."}]'::jsonb
  );

  IF (v_pick ->> 'facts_inserted')::int <> 1 OR (v_pick ->> 'facts_skipped')::int <> 2 THEN
    RAISE EXCEPTION 'apply_brief debía insertar 1 hecho y descartar 2, dio %', v_pick;
  END IF;

  SELECT count(*) INTO v_n FROM public.facts WHERE user_id = v_user;
  IF v_n <> 3 THEN
    RAISE EXCEPTION 'debía haber 3 hechos en total, hay %', v_n;
  END IF;

  -- el brief anterior quedó en el histórico
  SELECT count(*) INTO v_n FROM public.coaching_brief_history WHERE user_id = v_user;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'el brief anterior debía quedar en coaching_brief_history, hay % filas', v_n;
  END IF;
  SELECT text INTO v_txt FROM public.coaching_brief_history WHERE user_id = v_user;
  IF v_txt <> 'Push the learner to use the past simple; they avoid it.' THEN
    RAISE EXCEPTION 'el histórico debía guardar el brief anterior, guardó "%"', v_txt;
  END IF;

  SELECT text, source_session_id INTO v_txt, v_prev
  FROM public.coaching_briefs WHERE user_id = v_user;
  IF v_txt <> 'Second brief: keep pushing the past simple.' OR v_prev <> v_sid2 THEN
    RAISE EXCEPTION 'el brief vigente debía ser el nuevo, es "%"', v_txt;
  END IF;

  -- =========================================================================
  -- 6. Recortes: 600 caracteres de brief y 5 errores recurrentes
  -- =========================================================================
  v_pick := public.apply_brief(
    v_sid3,
    repeat('x', 900),
    NULL,
    '[{"category":"a"},{"category":"b"},{"category":"c"},{"category":"d"},
      {"category":"e"},{"category":"f"},{"category":"g"}]'::jsonb,
    '[]'::jsonb
  );

  SELECT text, jsonb_array_length(recurring_errors) INTO v_txt, v_n
  FROM public.coaching_briefs WHERE user_id = v_user;
  IF char_length(v_txt) <> 600 THEN
    RAISE EXCEPTION 'el brief debía recortarse a 600 caracteres, tiene %', char_length(v_txt);
  END IF;
  IF v_n <> 5 THEN
    RAISE EXCEPTION 'recurring_errors debía recortarse a 5, tiene %', v_n;
  END IF;

  -- un brief vacío es un error, no un brief vacío guardado
  DELETE FROM public.sessions WHERE id = v_sid3;
  INSERT INTO public.sessions (id, user_id, kind, topic)
  VALUES (v_sid3, v_user, 'free_topic', 'sesión 3 bis');
  v_txt := NULL;
  BEGIN
    PERFORM public.apply_brief(v_sid3, '   ', NULL, '[]'::jsonb, '[]'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    v_txt := SQLERRM;
  END;
  IF v_txt IS DISTINCT FROM 'BRIEF_EMPTY' THEN
    RAISE EXCEPTION 'un brief vacío debía dar BRIEF_EMPTY, dio %', v_txt;
  END IF;

  -- =========================================================================
  -- Limpieza
  -- =========================================================================
  DELETE FROM public.coaching_brief_history WHERE user_id = v_user;
  DELETE FROM public.coaching_briefs WHERE user_id = v_user;
  DELETE FROM public.facts WHERE user_id = v_user;
  DELETE FROM public.sessions WHERE user_id = v_user;
  DELETE FROM public.profiles WHERE user_id = v_user;

  RAISE NOTICE 'memoria: todas las comprobaciones en verde';
END;
$test$;
