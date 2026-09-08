-- Test SQL de `redeem_invitation` (SPEC-01 §5, migración 1).
-- Ejecutar desde apps/api con:
--   ./scripts/run-sql-test.sh migrations/tests/redeem_invitation.sql
-- Requiere los usuarios de prueba: node scripts/db-test-users.ts
--
-- Las políticas RLS de esta migración se comprueban con tokens de usuario
-- reales en scripts/db-smoke.ts: `db query` de InsForge rechaza cambiar la
-- configuración de sesión, así que desde SQL no se puede hacer SET ROLE.
--
-- Si algo falla, el bloque lanza RAISE EXCEPTION y el comando sale con error.
-- Si todo pasa no devuelve filas y limpia lo que creó.

DO $test$
DECLARE
  v_a        uuid;
  v_b        uuid;
  v_c        uuid;
  v_group    uuid;
  v_code_a   text := 'TESTAAA2';
  v_code_b   text := 'TESTBBB3';
  v_code_exp text := 'TESTEXP4';
  v_result   jsonb;
  v_n        int;
  v_error    text;
BEGIN
  -- ---- usuarios de prueba -------------------------------------------------
  SELECT id INTO v_a FROM auth.users WHERE email = 'sqltest-a@fluent.test';
  SELECT id INTO v_b FROM auth.users WHERE email = 'sqltest-b@fluent.test';
  SELECT id INTO v_c FROM auth.users WHERE email = 'sqltest-c@fluent.test';
  IF v_a IS NULL OR v_b IS NULL OR v_c IS NULL THEN
    RAISE EXCEPTION 'faltan usuarios de prueba; ejecuta: node scripts/db-test-users.ts';
  END IF;

  -- ---- estado limpio ------------------------------------------------------
  DELETE FROM public.profiles WHERE user_id IN (v_a, v_b, v_c);
  DELETE FROM public.invitations WHERE code IN (v_code_a, v_code_b, v_code_exp);
  DELETE FROM public.groups WHERE name = 'test-redeem-invitation';

  INSERT INTO public.groups (name, owner_id) VALUES ('test-redeem-invitation', v_a)
    RETURNING id INTO v_group;

  INSERT INTO public.invitations (code, group_id, created_by) VALUES
    (v_code_a, v_group, v_a),
    (v_code_b, v_group, v_a);
  INSERT INTO public.invitations (code, group_id, created_by, expires_at)
    VALUES (v_code_exp, v_group, v_a, now() - interval '1 day');

  INSERT INTO public.profiles (user_id, display_name, level, onboarded_at) VALUES
    (v_a, 'Test A', 'B1', now()),
    (v_b, 'Test B', 'A2', now()),
    (v_c, 'Test C', 'B2', now());

  -- ---- canje correcto -----------------------------------------------------
  v_result := public.redeem_invitation(v_code_a, v_a);
  IF (v_result ->> 'group_id')::uuid IS DISTINCT FROM v_group THEN
    RAISE EXCEPTION 'redeem_invitation no devolvió el grupo esperado: %', v_result;
  END IF;

  SELECT count(*) INTO v_n
  FROM public.profiles WHERE user_id = v_a AND group_id = v_group;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'redeem_invitation no asignó group_id al perfil';
  END IF;

  SELECT count(*) INTO v_n
  FROM public.invitations
  WHERE code = v_code_a AND used_by = v_a AND used_at IS NOT NULL;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'la invitación canjeada no quedó marcada como usada';
  END IF;

  -- ---- el código se normaliza (minúsculas y espacios) ---------------------
  PERFORM public.redeem_invitation('  ' || lower(v_code_b) || ' ', v_b);
  SELECT count(*) INTO v_n
  FROM public.profiles WHERE user_id = v_b AND group_id = v_group;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'redeem_invitation debía aceptar el código en minúsculas';
  END IF;

  -- ---- errores ------------------------------------------------------------
  v_error := NULL;
  BEGIN
    PERFORM public.redeem_invitation(v_code_b, v_a);
  EXCEPTION WHEN OTHERS THEN v_error := SQLERRM;
  END;
  IF v_error IS DISTINCT FROM 'ALREADY_IN_GROUP' THEN
    RAISE EXCEPTION 'canjear con grupo asignado debía dar ALREADY_IN_GROUP, dio %', v_error;
  END IF;

  v_error := NULL;
  BEGIN
    PERFORM public.redeem_invitation('ZZZZZZZZ', v_c);
  EXCEPTION WHEN OTHERS THEN v_error := SQLERRM;
  END;
  IF v_error IS DISTINCT FROM 'INVITATION_INVALID' THEN
    RAISE EXCEPTION 'código inexistente debía dar INVITATION_INVALID, dio %', v_error;
  END IF;

  v_error := NULL;
  BEGIN
    PERFORM public.redeem_invitation(v_code_exp, v_c);
  EXCEPTION WHEN OTHERS THEN v_error := SQLERRM;
  END;
  IF v_error IS DISTINCT FROM 'INVITATION_EXPIRED' THEN
    RAISE EXCEPTION 'código caducado debía dar INVITATION_EXPIRED, dio %', v_error;
  END IF;

  v_error := NULL;
  BEGIN
    PERFORM public.redeem_invitation(v_code_b, v_c);
  EXCEPTION WHEN OTHERS THEN v_error := SQLERRM;
  END;
  IF v_error IS DISTINCT FROM 'INVITATION_USED' THEN
    RAISE EXCEPTION 'código ya usado debía dar INVITATION_USED, dio %', v_error;
  END IF;

  v_error := NULL;
  BEGIN
    PERFORM public.redeem_invitation(v_code_a, NULL);
  EXCEPTION WHEN OTHERS THEN v_error := SQLERRM;
  END;
  IF v_error IS DISTINCT FROM 'UNAUTHENTICATED' THEN
    RAISE EXCEPTION 'sin usuario debía dar UNAUTHENTICATED, dio %', v_error;
  END IF;

  -- C sigue sin grupo tras todos los intentos fallidos
  SELECT count(*) INTO v_n FROM public.profiles WHERE user_id = v_c AND group_id IS NULL;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'C no debía haber entrado a ningún grupo';
  END IF;

  -- ---- el alfabeto de los códigos excluye 0, O, 1 e I ---------------------
  v_error := NULL;
  BEGIN
    INSERT INTO public.invitations (code, group_id) VALUES ('O0I1ABCD', v_group);
  EXCEPTION WHEN OTHERS THEN v_error := SQLSTATE;
  END;
  IF v_error IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'el CHECK del código debía rechazar caracteres ambiguos, dio %', v_error;
  END IF;

  -- ---- limpieza -----------------------------------------------------------
  DELETE FROM public.profiles WHERE user_id IN (v_a, v_b, v_c);
  DELETE FROM public.invitations WHERE code IN (v_code_a, v_code_b, v_code_exp);
  DELETE FROM public.groups WHERE name = 'test-redeem-invitation';

  RAISE NOTICE 'redeem_invitation: todas las comprobaciones en verde';
END;
$test$;
