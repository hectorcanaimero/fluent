-- Test SQL del esquema de la sala grupal (migración 20261006120000).
-- Ejecutar desde apps/api con:
--   ./scripts/run-sql-test.sh migrations/tests/group_sessions.sql
-- Requiere los usuarios de prueba: node scripts/db-test-users.ts
--
-- Cubre: el índice único parcial de sala activa por grupo, que una sala
-- `ended` no bloquea abrir otra y el check de `system_event` fuera de catálogo
-- en los mensajes de sistema. Cualquier fallo lanza RAISE EXCEPTION.

DO $test$
DECLARE
  v_a      uuid;
  v_group  uuid;
  v_sid    uuid;
  v_sid2   uuid;
  v_error  text;
  v_sqlstate text;
  v_n      int;
BEGIN
  SELECT id INTO v_a FROM auth.users WHERE email = 'sqltest-a@fluent.test';
  IF v_a IS NULL THEN
    RAISE EXCEPTION 'faltan usuarios de prueba; ejecuta: node scripts/db-test-users.ts';
  END IF;

  INSERT INTO public.groups (name) VALUES ('test-group-sessions')
    RETURNING id INTO v_group;

  -- =========================================================================
  -- 1. Índice único parcial: una segunda sala activa del mismo grupo falla.
  -- =========================================================================
  INSERT INTO public.group_sessions (group_id, initiator_id, kind, topic)
  VALUES (v_group, v_a, 'free_topic', 'primera sala')
    RETURNING id INTO v_sid;

  v_error := NULL;
  BEGIN
    INSERT INTO public.group_sessions (group_id, initiator_id, kind, topic)
    VALUES (v_group, v_a, 'free_topic', 'segunda sala, misma activa');
  EXCEPTION WHEN unique_violation THEN v_error := SQLSTATE;
  END;
  IF v_error IS DISTINCT FROM '23505' THEN
    RAISE EXCEPTION 'una segunda sala activa del mismo grupo debía violar el índice único, dio %', v_error;
  END IF;

  -- =========================================================================
  -- 2. Una sala `ended` no bloquea abrir otra.
  -- =========================================================================
  UPDATE public.group_sessions
     SET status = 'ended', end_reason = 'initiator', ended_at = now()
   WHERE id = v_sid;

  INSERT INTO public.group_sessions (group_id, initiator_id, kind, topic)
  VALUES (v_group, v_a, 'free_topic', 'segunda sala, la primera ya cerró')
    RETURNING id INTO v_sid2;

  SELECT count(*) INTO v_n
  FROM public.group_sessions WHERE group_id = v_group AND status = 'active';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'debía haber exactamente una sala activa tras cerrar la primera, hay %', v_n;
  END IF;

  -- =========================================================================
  -- 3. `role = 'system'` con un `system_event` fuera del check falla.
  -- =========================================================================
  v_error := NULL;
  v_sqlstate := NULL;
  BEGIN
    INSERT INTO public.group_session_messages (session_id, role, text, system_event)
    VALUES (v_sid2, 'system', 'evento raro', 'no_existe_en_el_catalogo');
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  IF v_sqlstate IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'un system_event fuera de catálogo debía violar un check, dio %', v_sqlstate;
  END IF;

  -- `role = 'system'` sin `system_event` también falla (el check cruzado).
  v_sqlstate := NULL;
  BEGIN
    INSERT INTO public.group_session_messages (session_id, role, text)
    VALUES (v_sid2, 'system', 'falta el evento');
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  IF v_sqlstate IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'un mensaje de sistema sin system_event debía violar el check cruzado, dio %', v_sqlstate;
  END IF;

  -- Un mensaje de sistema válido sí entra.
  INSERT INTO public.group_session_messages (session_id, role, text, system_event)
  VALUES (v_sid2, 'system', 'se unió', 'joined');

  -- =========================================================================
  -- Limpieza
  -- =========================================================================
  DELETE FROM public.group_session_messages WHERE session_id IN (v_sid, v_sid2);
  DELETE FROM public.group_sessions WHERE id IN (v_sid, v_sid2);
  DELETE FROM public.groups WHERE id = v_group;

  RAISE NOTICE 'group_sessions: todas las comprobaciones en verde';
END;
$test$;
