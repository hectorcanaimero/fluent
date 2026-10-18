-- Test SQL de los arreglos de la sala grupal (migración 20261018120000).
-- Ejecutar desde apps/api con:
--   ./scripts/run-sql-test.sh migrations/tests/group_sessions_checks.sql
-- Requiere los usuarios de prueba: node scripts/db-test-users.ts
--
-- Cubre: borrar una noticia usada por una sala grupal la deja en null (la
-- purga de rss-ingest no puede fallar con 23503) y los checks de coherencia
-- kind/news_item_id, kind/roleplay_id y status/ended_at/end_reason.
-- Cualquier fallo lanza RAISE EXCEPTION.

DO $test$
DECLARE
  v_a        uuid;
  v_group    uuid;
  v_news     uuid;
  v_sid      uuid;
  v_sqlstate text;
  v_news_ref uuid;
BEGIN
  SELECT id INTO v_a FROM auth.users WHERE email = 'sqltest-a@fluent.test';
  IF v_a IS NULL THEN
    RAISE EXCEPTION 'faltan usuarios de prueba; ejecuta: node scripts/db-test-users.ts';
  END IF;

  INSERT INTO public.groups (name) VALUES ('test-group-sessions-checks')
    RETURNING id INTO v_group;

  INSERT INTO public.news_items (source, url, title)
  VALUES ('test', 'https://test.fluent/group-sessions-checks', 'Noticia de prueba')
    RETURNING id INTO v_news;

  -- =========================================================================
  -- 1. Borrar una noticia usada por una sala grupal pone news_item_id a null.
  -- =========================================================================
  INSERT INTO public.group_sessions (group_id, initiator_id, kind, topic, news_item_id)
  VALUES (v_group, v_a, 'news', 'sala de noticia', v_news)
    RETURNING id INTO v_sid;

  DELETE FROM public.news_items WHERE id = v_news;

  SELECT news_item_id INTO v_news_ref FROM public.group_sessions WHERE id = v_sid;
  IF v_news_ref IS NOT NULL THEN
    RAISE EXCEPTION 'borrar la noticia debía dejar news_item_id en null, quedó %', v_news_ref;
  END IF;

  -- =========================================================================
  -- 2. news_item_id solo con kind='news'.
  -- =========================================================================
  INSERT INTO public.news_items (source, url, title)
  VALUES ('test', 'https://test.fluent/group-sessions-checks-2', 'Otra noticia')
    RETURNING id INTO v_news;

  v_sqlstate := NULL;
  BEGIN
    UPDATE public.group_sessions SET kind = 'free_topic', news_item_id = v_news WHERE id = v_sid;
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  IF v_sqlstate IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'news_item_id con kind=free_topic debía violar un check, dio %', v_sqlstate;
  END IF;

  -- =========================================================================
  -- 3. roleplay_id solo con kind='roleplay'.
  -- =========================================================================
  v_sqlstate := NULL;
  BEGIN
    UPDATE public.group_sessions SET roleplay_id = 'job-interview' WHERE id = v_sid;
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  IF v_sqlstate IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'roleplay_id con kind=news debía violar un check, dio %', v_sqlstate;
  END IF;

  -- =========================================================================
  -- 4. status='ended' si y solo si ended_at y end_reason están puestos.
  -- =========================================================================
  v_sqlstate := NULL;
  BEGIN
    UPDATE public.group_sessions SET status = 'ended' WHERE id = v_sid;
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  IF v_sqlstate IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'status=ended sin ended_at ni end_reason debía violar un check, dio %', v_sqlstate;
  END IF;

  v_sqlstate := NULL;
  BEGIN
    UPDATE public.group_sessions SET status = 'ended', ended_at = now() WHERE id = v_sid;
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  IF v_sqlstate IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'status=ended sin end_reason debía violar un check, dio %', v_sqlstate;
  END IF;

  v_sqlstate := NULL;
  BEGIN
    UPDATE public.group_sessions SET ended_at = now() WHERE id = v_sid;
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  IF v_sqlstate IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'una sala activa con ended_at debía violar un check, dio %', v_sqlstate;
  END IF;

  -- El cierre completo (lo que hará close_group_session) sí entra.
  UPDATE public.group_sessions
     SET status = 'ended', ended_at = now(), end_reason = 'initiator'
   WHERE id = v_sid;

  -- =========================================================================
  -- Limpieza
  -- =========================================================================
  DELETE FROM public.group_sessions WHERE id = v_sid;
  DELETE FROM public.news_items WHERE id = v_news;
  DELETE FROM public.groups WHERE id = v_group;

  RAISE NOTICE 'group_sessions_checks: todas las comprobaciones en verde';
END;
$test$;
