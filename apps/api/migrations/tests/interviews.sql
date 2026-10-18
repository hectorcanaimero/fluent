-- Test SQL del simulador de entrevistas (migración 20261018130000).
-- Ejecutar desde apps/api con:
--   ./scripts/run-sql-test.sh migrations/tests/interviews.sql
-- Requiere los usuarios de prueba: node scripts/db-test-users.ts
--
-- `db query` de InsForge corre como `project_admin` y rechaza cambiar la
-- configuración de sesión, así que desde SQL no se puede hacer SET ROLE para
-- actuar como `authenticated` (mismo límite que proveedores.sql y
-- redeem_invitation.sql). El aislamiento entre usuarios se comprueba acá con
-- el mismo filtro que usan las políticas (`user_id = auth.uid()`) y además
-- verificando en pg_policies que la política exista con ese predicado; el
-- comportamiento end-to-end con tokens reales queda para scripts/db-smoke.ts.
--
-- Cubre (F10.1.T1): aislamiento de `interviews` entre usuarios,
-- `sessions.kind = 'interview'` aceptado, `study_cycle_sessions.idx = 6`
-- rechazado y que borrar una entrevista deja en null `sessions.interview_id`.
-- Cualquier fallo lanza RAISE EXCEPTION.

DO $test$
DECLARE
  v_a         uuid;
  v_b         uuid;
  v_interview_a uuid;
  v_interview_b uuid;
  v_session   uuid;
  v_cycle     uuid;
  v_n         int;
  v_check_id  uuid;
  v_sqlstate  text;
  v_qual      text;
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

  -- =========================================================================
  -- 1. interviews: aislamiento entre usuarios.
  -- =========================================================================
  INSERT INTO public.interviews (user_id, type, offer_text, offer_hash, status)
  VALUES (v_a, 'technical', 'oferta de A', 'hash-a', 'ready')
    RETURNING id INTO v_interview_a;

  INSERT INTO public.interviews (user_id, type, offer_text, offer_hash, status)
  VALUES (v_b, 'mixed', 'oferta de B', 'hash-b', 'ready')
    RETURNING id INTO v_interview_b;

  -- Mismo filtro que la política interviews_select_own: B no ve la de A.
  SELECT count(*) INTO v_n FROM public.interviews
  WHERE user_id = v_b AND id = v_interview_a;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'B no debía ver la entrevista de A';
  END IF;

  SELECT count(*) INTO v_n FROM public.interviews WHERE user_id = v_b;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'B debía ver exactamente su propia entrevista, vio %', v_n;
  END IF;

  -- La política de lectura por dueño existe y filtra por auth.uid().
  SELECT qual INTO v_qual FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'interviews' AND policyname = 'interviews_select_own';
  IF v_qual IS NULL OR v_qual NOT ILIKE '%auth.uid%' THEN
    RAISE EXCEPTION 'falta la política interviews_select_own con auth.uid(), quedó: %', v_qual;
  END IF;

  -- =========================================================================
  -- 2. sessions.kind = 'interview' aceptado; 'bogus' rechazado.
  -- =========================================================================
  INSERT INTO public.sessions (user_id, kind, topic, interview_id)
  VALUES (v_a, 'interview', 'Entrevista', v_interview_a)
    RETURNING id INTO v_session;

  SELECT count(*) INTO v_n FROM public.sessions WHERE id = v_session AND kind = 'interview';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'sessions.kind = interview debía aceptarse';
  END IF;

  v_sqlstate := NULL;
  BEGIN
    INSERT INTO public.sessions (user_id, kind, topic) VALUES (v_a, 'bogus-kind', 'x');
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  IF v_sqlstate IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'kind inválido debía dar SQLSTATE 23514, dio %', v_sqlstate;
  END IF;

  -- =========================================================================
  -- 3. borrar la entrevista deja sessions.interview_id en null.
  -- =========================================================================
  DELETE FROM public.interviews WHERE id = v_interview_a;

  SELECT interview_id INTO v_check_id FROM public.sessions WHERE id = v_session;
  IF v_check_id IS NOT NULL THEN
    RAISE EXCEPTION 'sessions.interview_id debía quedar en null tras borrar la entrevista';
  END IF;

  -- =========================================================================
  -- 4. study_cycle_sessions.idx: entre 1 y 5; 6 rechazado.
  -- =========================================================================
  INSERT INTO public.study_cycles (user_id, interview_id, status)
  VALUES (v_b, v_interview_b, 'active')
    RETURNING id INTO v_cycle;

  INSERT INTO public.study_cycle_sessions (cycle_id, idx, focus, title, format, est_min, brief)
  VALUES (v_cycle, 5, 'english', 'Repaso de inglés', 'guided', 12, 'practicar tiempos verbales');

  SELECT count(*) INTO v_n FROM public.study_cycle_sessions WHERE cycle_id = v_cycle AND idx = 5;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'study_cycle_sessions.idx = 5 debía aceptarse';
  END IF;

  v_sqlstate := NULL;
  BEGIN
    INSERT INTO public.study_cycle_sessions (cycle_id, idx, focus, title, format, est_min, brief)
    VALUES (v_cycle, 6, 'c1', 'Fuera de rango', 'roleplay', 15, 'no debería entrar');
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  IF v_sqlstate IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'study_cycle_sessions.idx = 6 debía dar SQLSTATE 23514, dio %', v_sqlstate;
  END IF;

  -- study_cycle_sessions se autoriza por el user_id del ciclo (owns_study_cycle).
  SELECT qual INTO v_qual FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'study_cycle_sessions'
    AND policyname = 'study_cycle_sessions_select_own';
  IF v_qual IS NULL OR v_qual NOT ILIKE '%owns_study_cycle%' THEN
    RAISE EXCEPTION 'falta la política study_cycle_sessions_select_own con owns_study_cycle, quedó: %', v_qual;
  END IF;

  -- ---- limpieza -------------------------------------------------------------
  DELETE FROM public.sessions WHERE id = v_session;
  DELETE FROM public.study_cycle_sessions WHERE cycle_id = v_cycle;
  DELETE FROM public.study_cycles WHERE id = v_cycle;
  DELETE FROM public.interviews WHERE id IN (v_interview_a, v_interview_b);

  RAISE NOTICE 'interviews: todas las comprobaciones en verde';
END;
$test$;
