-- Test SQL del grupo por defecto (migración 20260919160000).
-- Ejecutar desde apps/api con:
--   ./scripts/run-sql-test.sh migrations/tests/default_group.sql
-- Requiere los usuarios de prueba: node scripts/db-test-users.ts
--
-- Si algo falla, el bloque lanza RAISE EXCEPTION y se revierte entero. Si
-- todo pasa, limpia lo que creó y deja el grupo por defecto real como estaba.

DO $test$
DECLARE
  v_a        uuid;
  v_b        uuid;
  v_real     uuid;
  v_default  uuid;
  v_friends  uuid;
  v_code     text := 'TESTDEF2';
  v_n        int;
  v_error    text;
BEGIN
  SELECT id INTO v_a FROM auth.users WHERE email = 'sqltest-a@fluent.test';
  SELECT id INTO v_b FROM auth.users WHERE email = 'sqltest-b@fluent.test';
  IF v_a IS NULL OR v_b IS NULL THEN
    RAISE EXCEPTION 'faltan usuarios de prueba; ejecuta: node scripts/db-test-users.ts';
  END IF;

  -- ---- estado limpio ------------------------------------------------------
  SELECT id INTO v_real FROM public.groups WHERE is_default;
  UPDATE public.groups SET is_default = false WHERE is_default;
  DELETE FROM public.profiles WHERE user_id IN (v_a, v_b);
  DELETE FROM public.invitations WHERE code = v_code;
  DELETE FROM public.groups WHERE name IN ('test-default', 'test-friends');

  INSERT INTO public.groups (name, is_default) VALUES ('test-default', true)
    RETURNING id INTO v_default;
  INSERT INTO public.groups (name, owner_id) VALUES ('test-friends', v_b)
    RETURNING id INTO v_friends;

  -- ---- un perfil nuevo sin grupo entra al grupo por defecto ---------------
  INSERT INTO public.profiles (user_id, display_name, level)
    VALUES (v_a, 'Test A', 'A2');
  SELECT count(*) INTO v_n
  FROM public.profiles WHERE user_id = v_a AND group_id = v_default;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'el perfil nuevo debía entrar al grupo por defecto';
  END IF;

  -- ---- un grupo explícito se respeta --------------------------------------
  INSERT INTO public.profiles (user_id, group_id, display_name, level)
    VALUES (v_b, v_friends, 'Test B', 'A2');
  SELECT count(*) INTO v_n
  FROM public.profiles WHERE user_id = v_b AND group_id = v_friends;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'el trigger no debía pisar un group_id explícito';
  END IF;

  -- ---- un código saca del grupo por defecto -------------------------------
  INSERT INTO public.invitations (code, group_id, created_by)
    VALUES (v_code, v_friends, v_b);
  PERFORM public.redeem_invitation(v_code, v_a);
  SELECT count(*) INTO v_n
  FROM public.profiles WHERE user_id = v_a AND group_id = v_friends;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'canjear desde el grupo por defecto debía mover al grupo del amigo';
  END IF;

  -- ---- desde un grupo normal sigue siendo ALREADY_IN_GROUP ----------------
  UPDATE public.invitations SET used_by = NULL, used_at = NULL WHERE code = v_code;
  v_error := NULL;
  BEGIN
    PERFORM public.redeem_invitation(v_code, v_b);
  EXCEPTION WHEN OTHERS THEN v_error := SQLERRM;
  END;
  IF v_error IS DISTINCT FROM 'ALREADY_IN_GROUP' THEN
    RAISE EXCEPTION 'con grupo normal debía dar ALREADY_IN_GROUP, dio %', v_error;
  END IF;

  -- ---- a lo sumo un grupo por defecto -------------------------------------
  v_error := NULL;
  BEGIN
    UPDATE public.groups SET is_default = true WHERE id = v_friends;
  EXCEPTION WHEN OTHERS THEN v_error := SQLSTATE;
  END;
  IF v_error IS DISTINCT FROM '23505' THEN
    RAISE EXCEPTION 'un segundo grupo por defecto debía violar el índice único, dio %', v_error;
  END IF;

  -- ---- limpieza -----------------------------------------------------------
  DELETE FROM public.profiles WHERE user_id IN (v_a, v_b);
  DELETE FROM public.invitations WHERE code = v_code;
  DELETE FROM public.groups WHERE id IN (v_default, v_friends);
  UPDATE public.groups SET is_default = true WHERE id = v_real;

  RAISE NOTICE 'default_group: todas las comprobaciones en verde';
END;
$test$;
