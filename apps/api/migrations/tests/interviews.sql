-- Test SQL del simulador de entrevistas (migración 20261018130000).
-- Ejecutar desde apps/api con:
--   ./scripts/run-sql-test.sh migrations/tests/interviews.sql
-- Requiere los usuarios de prueba: node scripts/db-test-users.ts
--
-- Cubre (F10.1.T1):
--   1. Permisos (FR-7): ni `anon` ni `authenticated` tienen privilegios sobre
--      las 4 tablas, así que `plan` y las preguntas no salen de la API. Se mira
--      en el catálogo (has_*_privilege) y, si la conexión puede hacer SET ROLE,
--      también actuando como `authenticated`: `SELECT plan` da 42501 y
--      owns_study_cycle() solo es cierto para el dueño. `db query` de InsForge
--      corre como `project_admin` y no puede cambiar de rol (ver
--      proveedores.sql); ahí esa parte se salta con un NOTICE.
--   2. sessions.kind = 'interview' aceptado; kind inválido rechazado.
--   3. Checks nuevos: oferta sin texto ni URL, answered_count < 0,
--      est_min = 0, idx = 6, interview_id/study_cycle_session_id con otro kind.
--   4. study_cycles: uno por entrevista (UNIQUE) y la FK compuesta impide
--      colgar el ciclo de la entrevista de otro usuario.
--   5. Borrar la entrevista deja sessions.interview_id en null y borrar una
--      study_cycle_session deja sessions.study_cycle_session_id en null.
-- Cualquier fallo lanza RAISE EXCEPTION (y deshace el SET LOCAL ROLE).

DO $test$
DECLARE
  v_a           uuid;
  v_b           uuid;
  v_interview_a uuid;
  v_interview_b uuid;
  v_session     uuid;
  v_session_st  uuid;
  v_cycle_a     uuid;
  v_scs         uuid;
  v_n           int;
  v_ok          boolean;
  v_check_id    uuid;
  v_sqlstate    text;
  v_can_set     boolean;
  v_t           text;
  v_r           text;
BEGIN
  -- ---- usuarios de prueba -------------------------------------------------
  SELECT id INTO v_a FROM auth.users WHERE email = 'sqltest-a@fluent.test';
  SELECT id INTO v_b FROM auth.users WHERE email = 'sqltest-b@fluent.test';
  IF v_a IS NULL OR v_b IS NULL THEN
    RAISE EXCEPTION 'faltan usuarios de prueba; ejecuta: node scripts/db-test-users.ts';
  END IF;

  -- ---- estado limpio ------------------------------------------------------
  DELETE FROM public.sessions WHERE user_id IN (v_a, v_b) AND kind IN ('interview', 'study');
  DELETE FROM public.interviews WHERE user_id IN (v_a, v_b);

  INSERT INTO public.interviews (user_id, type, offer_text, offer_hash, status, plan)
  VALUES (v_a, 'technical', 'oferta de A', 'hash-a', 'ready', '{"questions":["secreta"]}')
    RETURNING id INTO v_interview_a;

  INSERT INTO public.interviews (user_id, type, offer_url, offer_hash, status)
  VALUES (v_b, 'mixed', 'https://example.com/oferta-b', 'hash-b', 'ready')
    RETURNING id INTO v_interview_b;

  INSERT INTO public.study_cycles (user_id, interview_id, status)
  VALUES (v_a, v_interview_a, 'active') RETURNING id INTO v_cycle_a;

  -- =========================================================================
  -- 1. Permisos: nada para anon/authenticated (FR-7).
  -- =========================================================================
  FOREACH v_r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH v_t IN ARRAY ARRAY['public.interviews', 'public.interview_questions_asked',
                               'public.study_cycles', 'public.study_cycle_sessions'] LOOP
      IF has_table_privilege(v_r, v_t, 'SELECT, INSERT, UPDATE, DELETE') THEN
        RAISE EXCEPTION '% no debía tener privilegios sobre %', v_r, v_t;
      END IF;
    END LOOP;
    IF has_column_privilege(v_r, 'public.interviews', 'plan', 'SELECT') THEN
      RAISE EXCEPTION '% no debía poder leer interviews.plan', v_r;
    END IF;
  END LOOP;

  -- Actuando como `authenticated`, si la conexión puede cambiar de rol.
  v_can_set := true;
  BEGIN
    SET LOCAL ROLE authenticated;
  EXCEPTION WHEN OTHERS THEN v_can_set := false;
  END;

  IF v_can_set THEN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_b, 'role', 'authenticated')::text, true);

    v_sqlstate := NULL;
    BEGIN
      PERFORM plan FROM public.interviews LIMIT 1;
    EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
    END;
    IF v_sqlstate IS DISTINCT FROM '42501' THEN
      RAISE EXCEPTION 'authenticated no debía poder leer interviews.plan (42501), dio %', v_sqlstate;
    END IF;

    v_sqlstate := NULL;
    BEGIN
      PERFORM 1 FROM public.interview_questions_asked LIMIT 1;
    EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
    END;
    IF v_sqlstate IS DISTINCT FROM '42501' THEN
      RAISE EXCEPTION 'authenticated no debía poder leer interview_questions_asked (42501), dio %', v_sqlstate;
    END IF;

    -- Predicado de study_cycle_sessions_select_own: B no es dueño del ciclo de A.
    v_ok := public.owns_study_cycle(v_cycle_a);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
    IF v_ok OR NOT public.owns_study_cycle(v_cycle_a) THEN
      RAISE EXCEPTION 'owns_study_cycle debía ser cierto solo para el dueño (B=%)', v_ok;
    END IF;

    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
  ELSE
    RAISE NOTICE 'sin SET ROLE en esta conexión: permisos comprobados solo por catálogo';
  END IF;

  -- =========================================================================
  -- 2. sessions.kind = 'interview' aceptado; kind inválido rechazado.
  -- =========================================================================
  INSERT INTO public.sessions (user_id, kind, topic, interview_id)
  VALUES (v_a, 'interview', 'Entrevista', v_interview_a)
    RETURNING id INTO v_session;

  v_sqlstate := NULL;
  BEGIN
    INSERT INTO public.sessions (user_id, kind, topic) VALUES (v_a, 'bogus-kind', 'x');
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  IF v_sqlstate IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'kind inválido debía dar SQLSTATE 23514, dio %', v_sqlstate;
  END IF;

  -- =========================================================================
  -- 3. Checks nuevos.
  -- =========================================================================
  v_sqlstate := NULL;
  BEGIN
    INSERT INTO public.interviews (user_id, type, offer_hash, status)
    VALUES (v_a, 'technical', 'hash-x', 'ready');
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  IF v_sqlstate IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'oferta sin texto ni URL debía dar 23514, dio %', v_sqlstate;
  END IF;

  v_sqlstate := NULL;
  BEGIN
    UPDATE public.interviews SET answered_count = -1 WHERE id = v_interview_a;
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  IF v_sqlstate IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'answered_count < 0 debía dar 23514, dio %', v_sqlstate;
  END IF;

  v_sqlstate := NULL;
  BEGIN
    INSERT INTO public.sessions (user_id, kind, topic, interview_id)
    VALUES (v_a, 'free_topic', 'x', v_interview_a);
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  IF v_sqlstate IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'interview_id con kind <> interview debía dar 23514, dio %', v_sqlstate;
  END IF;

  INSERT INTO public.study_cycle_sessions (cycle_id, idx, focus, title, format, est_min, brief)
  VALUES (v_cycle_a, 5, 'english', 'Repaso de inglés', 'guided', 12, 'practicar tiempos verbales')
    RETURNING id INTO v_scs;

  v_sqlstate := NULL;
  BEGIN
    INSERT INTO public.study_cycle_sessions (cycle_id, idx, focus, title, format, est_min, brief)
    VALUES (v_cycle_a, 6, 'c1', 'Fuera de rango', 'roleplay', 15, 'no debería entrar');
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  IF v_sqlstate IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'study_cycle_sessions.idx = 6 debía dar 23514, dio %', v_sqlstate;
  END IF;

  v_sqlstate := NULL;
  BEGIN
    INSERT INTO public.study_cycle_sessions (cycle_id, idx, focus, title, format, est_min, brief)
    VALUES (v_cycle_a, 1, 'c1', 'Sin minutos', 'guided', 0, 'no debería entrar');
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  IF v_sqlstate IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'est_min = 0 debía dar 23514, dio %', v_sqlstate;
  END IF;

  v_sqlstate := NULL;
  BEGIN
    INSERT INTO public.sessions (user_id, kind, topic, study_cycle_session_id)
    VALUES (v_a, 'interview', 'x', v_scs);
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  IF v_sqlstate IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'study_cycle_session_id con kind <> study debía dar 23514, dio %', v_sqlstate;
  END IF;

  -- =========================================================================
  -- 4. study_cycles: uno por entrevista; FK compuesta (mismo usuario).
  -- =========================================================================
  v_sqlstate := NULL;
  BEGIN
    INSERT INTO public.study_cycles (user_id, interview_id, status)
    VALUES (v_a, v_interview_a, 'active');
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  IF v_sqlstate IS DISTINCT FROM '23505' THEN
    RAISE EXCEPTION 'un segundo ciclo de la misma entrevista debía dar 23505, dio %', v_sqlstate;
  END IF;

  v_sqlstate := NULL;
  BEGIN
    INSERT INTO public.study_cycles (user_id, interview_id, status)
    VALUES (v_a, v_interview_b, 'active');
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  IF v_sqlstate IS DISTINCT FROM '23503' THEN
    RAISE EXCEPTION 'un ciclo de A sobre la entrevista de B debía dar 23503, dio %', v_sqlstate;
  END IF;

  -- =========================================================================
  -- 5. ON DELETE SET NULL en sessions y cascada del ciclo.
  -- =========================================================================
  INSERT INTO public.sessions (user_id, kind, topic, study_cycle_session_id)
  VALUES (v_a, 'study', 'Estudio', v_scs)
    RETURNING id INTO v_session_st;

  DELETE FROM public.study_cycle_sessions WHERE id = v_scs;
  SELECT study_cycle_session_id INTO v_check_id FROM public.sessions WHERE id = v_session_st;
  IF v_check_id IS NOT NULL THEN
    RAISE EXCEPTION 'sessions.study_cycle_session_id debía quedar en null tras borrar la sesión del ciclo';
  END IF;

  DELETE FROM public.interviews WHERE id = v_interview_a;
  SELECT interview_id INTO v_check_id FROM public.sessions WHERE id = v_session;
  IF v_check_id IS NOT NULL THEN
    RAISE EXCEPTION 'sessions.interview_id debía quedar en null tras borrar la entrevista';
  END IF;

  SELECT count(*) INTO v_n FROM public.study_cycles WHERE id = v_cycle_a;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'el ciclo debía borrarse en cascada con la entrevista';
  END IF;

  -- ---- limpieza -------------------------------------------------------------
  DELETE FROM public.sessions WHERE id IN (v_session, v_session_st);
  DELETE FROM public.interviews WHERE id IN (v_interview_a, v_interview_b);

  RAISE NOTICE 'interviews: todas las comprobaciones en verde';
END;
$test$;
