-- Test SQL de `award_profile_completed` (MEJ-14).
-- Ejecutar desde apps/api con:
--   ./scripts/run-sql-test.sh migrations/tests/award_profile_completed.sql
-- Requiere los usuarios de prueba: node scripts/db-test-users.ts
--
-- Cubre: primera concesión, idempotencia, que no se sume XP en la segunda
-- llamada, importe no positivo y aislamiento entre usuarios. Cualquier fallo
-- lanza RAISE EXCEPTION.

DO $test$
DECLARE
  v_user  uuid;
  v_other uuid;
  v_xp0   int;
  v_res   int;
  v_n     int;
BEGIN
  SELECT id INTO v_user FROM auth.users ORDER BY created_at LIMIT 1;
  SELECT id INTO v_other FROM auth.users ORDER BY created_at OFFSET 1 LIMIT 1;
  IF v_user IS NULL OR v_other IS NULL THEN
    RAISE EXCEPTION 'faltan usuarios de prueba: corré node scripts/db-test-users.ts';
  END IF;

  DELETE FROM public.xp_events
   WHERE kind = 'profile_completed' AND user_id IN (v_user, v_other);

  SELECT xp INTO v_xp0 FROM public.profiles WHERE user_id = v_user;

  -- 1. Primera concesión: devuelve el importe y suma el XP.
  v_res := public.award_profile_completed(v_user, 20);
  IF v_res <> 20 THEN
    RAISE EXCEPTION '1: esperaba 20, devolvió %', v_res;
  END IF;

  SELECT xp INTO v_n FROM public.profiles WHERE user_id = v_user;
  IF v_n <> v_xp0 + 20 THEN
    RAISE EXCEPTION '1: xp esperado %, real %', v_xp0 + 20, v_n;
  END IF;

  SELECT count(*) INTO v_n
    FROM public.xp_events
   WHERE user_id = v_user AND kind = 'profile_completed';
  IF v_n <> 1 THEN
    RAISE EXCEPTION '1: esperaba 1 evento, hay %', v_n;
  END IF;

  -- 2. Segunda llamada: no concede nada ni vuelve a sumar.
  v_res := public.award_profile_completed(v_user, 20);
  IF v_res <> 0 THEN
    RAISE EXCEPTION '2: esperaba 0, devolvió %', v_res;
  END IF;

  SELECT xp INTO v_n FROM public.profiles WHERE user_id = v_user;
  IF v_n <> v_xp0 + 20 THEN
    RAISE EXCEPTION '2: el xp cambió en la segunda llamada: % -> %', v_xp0 + 20, v_n;
  END IF;

  SELECT count(*) INTO v_n
    FROM public.xp_events
   WHERE user_id = v_user AND kind = 'profile_completed';
  IF v_n <> 1 THEN
    RAISE EXCEPTION '2: esperaba 1 evento, hay %', v_n;
  END IF;

  -- 3. Importe no positivo: no hace nada.
  v_res := public.award_profile_completed(v_other, 0);
  IF v_res <> 0 THEN
    RAISE EXCEPTION '3: esperaba 0, devolvió %', v_res;
  END IF;

  SELECT count(*) INTO v_n
    FROM public.xp_events
   WHERE user_id = v_other AND kind = 'profile_completed';
  IF v_n <> 0 THEN
    RAISE EXCEPTION '3: no debía insertar evento, hay %', v_n;
  END IF;

  -- 4. Otro usuario sí puede cobrarlo: el índice es por usuario.
  v_res := public.award_profile_completed(v_other, 20);
  IF v_res <> 20 THEN
    RAISE EXCEPTION '4: esperaba 20 para el segundo usuario, devolvió %', v_res;
  END IF;

  DELETE FROM public.xp_events
   WHERE kind = 'profile_completed' AND user_id IN (v_user, v_other);
  UPDATE public.profiles SET xp = v_xp0 WHERE user_id = v_user;
  UPDATE public.profiles SET xp = xp - 20 WHERE user_id = v_other;

  RAISE NOTICE 'award_profile_completed: OK';
END;
$test$;
