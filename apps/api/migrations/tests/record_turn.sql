-- Test SQL de `record_turn` (MEJ-25).
-- Ejecutar desde apps/api con:
--   ./scripts/run-sql-test.sh migrations/tests/record_turn.sql
-- Requiere los usuarios de prueba: node scripts/db-test-users.ts
--
-- Cubre: inserción del turno con sus métricas, correcciones asociadas al
-- turno del usuario, actualización de turns_count y chat_model_used, el caso
-- sin correcciones, que un modelo nulo no borre el ya guardado, y la
-- atomicidad ante una corrección inválida. Cualquier fallo lanza EXCEPTION.

DO $test$
DECLARE
  v_user uuid;
  v_sid  uuid;
  v_res  jsonb;
  v_n    int;
  v_txt  text;
BEGIN
  SELECT id INTO v_user FROM auth.users ORDER BY created_at LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'faltan usuarios de prueba: corré node scripts/db-test-users.ts';
  END IF;

  INSERT INTO public.sessions (user_id, kind, topic, status, started_at, turns_count)
  VALUES (v_user, 'free_topic', 'Test record_turn', 'active', now(), 1)
  RETURNING id INTO v_sid;

  INSERT INTO public.turns (session_id, idx, role, text)
  VALUES (v_sid, 0, 'tutor', 'Hello!'), (v_sid, 1, 'user', 'I go yesterday');

  -- 1. Turno con dos correcciones.
  v_res := public.record_turn(
    v_sid, 2, 'I went, you mean?', 'gemini-2.5-flash', 120, 40, 800, 2,
    '[{"turn_idx":1,"original":"I go yesterday","corrected":"I went yesterday",
       "category":"past_simple","note":"Usá el pasado simple."},
      {"turn_idx":1,"original":"I go","corrected":"I went",
       "category":"past_simple","note":"Otra vez."}]'::jsonb
  );

  IF (v_res->>'turns_count')::int <> 2 THEN
    RAISE EXCEPTION '1: turns_count esperado 2, devolvió %', v_res->>'turns_count';
  END IF;

  SELECT text INTO v_txt FROM public.turns WHERE session_id = v_sid AND idx = 2;
  IF v_txt <> 'I went, you mean?' THEN
    RAISE EXCEPTION '1: el turno del tutor no se guardó bien: %', v_txt;
  END IF;

  SELECT count(*) INTO v_n FROM public.corrections WHERE session_id = v_sid;
  IF v_n <> 2 THEN
    RAISE EXCEPTION '1: esperaba 2 correcciones, hay %', v_n;
  END IF;

  SELECT count(*) INTO v_n
    FROM public.corrections WHERE session_id = v_sid AND turn_idx = 1;
  IF v_n <> 2 THEN
    RAISE EXCEPTION '1: las correcciones deben apuntar al turno del usuario (1)';
  END IF;

  SELECT turns_count INTO v_n FROM public.sessions WHERE id = v_sid;
  IF v_n <> 2 THEN
    RAISE EXCEPTION '1: turns_count en la fila es %, esperaba 2', v_n;
  END IF;

  -- 2. Turno sin correcciones.
  v_res := public.record_turn(
    v_sid, 4, 'Nice.', 'gemini-2.5-flash', 10, 5, 100, 3, '[]'::jsonb
  );
  SELECT count(*) INTO v_n FROM public.corrections WHERE session_id = v_sid;
  IF v_n <> 2 THEN
    RAISE EXCEPTION '2: no debía añadir correcciones, hay %', v_n;
  END IF;

  -- 3. Un modelo nulo (respuesta degradada) no borra el ya guardado.
  v_res := public.record_turn(v_sid, 6, 'Degradado', NULL, NULL, NULL, NULL, 4, '[]'::jsonb);
  SELECT chat_model_used INTO v_txt FROM public.sessions WHERE id = v_sid;
  IF v_txt IS DISTINCT FROM 'gemini-2.5-flash' THEN
    RAISE EXCEPTION '3: chat_model_used quedó en %, esperaba gemini-2.5-flash', v_txt;
  END IF;

  -- 4. Atomicidad: una categoría inválida revienta el CHECK y no debe dejar
  -- el turno del tutor insertado.
  BEGIN
    PERFORM public.record_turn(
      v_sid, 8, 'No debería quedar', 'm', 1, 1, 1, 5,
      '[{"turn_idx":7,"original":"x","corrected":"y",
         "category":"categoria_que_no_existe","note":"n"}]'::jsonb
    );
    RAISE EXCEPTION '4: esperaba que fallara por la categoría inválida';
  EXCEPTION WHEN check_violation OR foreign_key_violation OR invalid_text_representation THEN
    NULL; -- lo esperado
  END;

  SELECT count(*) INTO v_n FROM public.turns WHERE session_id = v_sid AND idx = 8;
  IF v_n <> 0 THEN
    RAISE EXCEPTION '4: el turno del tutor quedó insertado pese al fallo';
  END IF;

  DELETE FROM public.sessions WHERE id = v_sid;
  RAISE NOTICE 'record_turn: OK';
END;
$test$;
