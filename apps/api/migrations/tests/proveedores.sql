-- Test SQL de `provider_credentials` y `model_preferences` (SPEC-01 §2.4,
-- §2.5, migración 2).
-- Ejecutar desde apps/api con:
--   ./scripts/run-sql-test.sh migrations/tests/proveedores.sql
-- Requiere los usuarios de prueba: node scripts/db-test-users.ts
--
-- Las políticas RLS de `model_preferences` se comprueban por REST con tokens
-- reales en scripts/db-smoke.ts (T2): `db query` de InsForge rechaza cambiar
-- la configuración de sesión, así que desde SQL no se puede hacer SET ROLE.
-- Este test cubre lo que sí se puede probar como project_admin: los CHECK,
-- la UNIQUE de provider_credentials y el trigger de updated_at.
--
-- Si algo falla, el bloque lanza RAISE EXCEPTION y el comando sale con error.
-- Si todo pasa no devuelve filas y limpia lo que creó.

DO $test$
DECLARE
  v_a       uuid;
  v_b       uuid;
  v_sqlstate text;
  v_ts      timestamptz;
  v_n       int;
BEGIN
  -- ---- usuarios de prueba -------------------------------------------------
  SELECT id INTO v_a FROM auth.users WHERE email = 'sqltest-a@fluent.test';
  SELECT id INTO v_b FROM auth.users WHERE email = 'sqltest-b@fluent.test';
  IF v_a IS NULL OR v_b IS NULL THEN
    RAISE EXCEPTION 'faltan usuarios de prueba; ejecuta: node scripts/db-test-users.ts';
  END IF;

  -- ---- estado limpio ------------------------------------------------------
  DELETE FROM public.provider_credentials WHERE user_id IN (v_a, v_b);
  DELETE FROM public.model_preferences WHERE user_id IN (v_a, v_b);

  -- ===========================================================================
  -- provider_credentials
  -- ===========================================================================

  -- ---- inserción válida -----------------------------------------------------
  INSERT INTO public.provider_credentials
    (user_id, provider, key_ciphertext, key_iv, key_tag)
  VALUES
    (v_a, 'openrouter', '\xdeadbeef'::bytea, '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea);

  SELECT count(*) INTO v_n
  FROM public.provider_credentials WHERE user_id = v_a AND provider = 'openrouter';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'no se insertó la credencial válida de A';
  END IF;

  -- ---- CHECK de provider: solo openrouter o gemini ---------------------------
  v_sqlstate := NULL;
  BEGIN
    INSERT INTO public.provider_credentials
      (user_id, provider, key_ciphertext, key_iv, key_tag)
    VALUES
      (v_b, 'bogus-provider', '\xaa'::bytea, '\xbb'::bytea, '\xcc'::bytea);
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  IF v_sqlstate IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'provider inválido debía dar SQLSTATE 23514, dio %', v_sqlstate;
  END IF;

  -- ---- UNIQUE (user_id, provider) --------------------------------------------
  v_sqlstate := NULL;
  BEGIN
    INSERT INTO public.provider_credentials
      (user_id, provider, key_ciphertext, key_iv, key_tag)
    VALUES
      (v_a, 'openrouter', '\x11'::bytea, '\x22'::bytea, '\x33'::bytea);
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  IF v_sqlstate IS DISTINCT FROM '23505' THEN
    RAISE EXCEPTION 'duplicar (user_id, provider) debía dar SQLSTATE 23505, dio %', v_sqlstate;
  END IF;

  -- ---- CHECK de status --------------------------------------------------------
  v_sqlstate := NULL;
  BEGIN
    INSERT INTO public.provider_credentials
      (user_id, provider, key_ciphertext, key_iv, key_tag, status)
    VALUES
      (v_b, 'gemini', '\x11'::bytea, '\x22'::bytea, '\x33'::bytea, 'bogus-status');
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  IF v_sqlstate IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'status inválido debía dar SQLSTATE 23514, dio %', v_sqlstate;
  END IF;

  -- ---- status por defecto -----------------------------------------------------
  SELECT count(*) INTO v_n
  FROM public.provider_credentials WHERE user_id = v_a AND status = 'active';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'status debía tener el valor por defecto active';
  END IF;

  -- ===========================================================================
  -- model_preferences
  -- ===========================================================================

  -- ---- inserción válida con proveedores por defecto ---------------------------
  INSERT INTO public.model_preferences (user_id, chat_model, brief_model)
  VALUES (v_a, 'openrouter/some-chat-model', 'openrouter/some-brief-model');

  SELECT count(*) INTO v_n
  FROM public.model_preferences
  WHERE user_id = v_a AND chat_provider = 'openrouter' AND brief_provider = 'openrouter';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'model_preferences no aplicó los valores por defecto de proveedor';
  END IF;

  -- ---- CHECK de chat_provider ---------------------------------------------------
  v_sqlstate := NULL;
  BEGIN
    INSERT INTO public.model_preferences (user_id, chat_provider, chat_model, brief_model)
    VALUES (v_b, 'bogus-provider', 'x', 'y');
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  IF v_sqlstate IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'chat_provider inválido debía dar SQLSTATE 23514, dio %', v_sqlstate;
  END IF;

  -- ---- CHECK de brief_provider ---------------------------------------------------
  v_sqlstate := NULL;
  BEGIN
    INSERT INTO public.model_preferences (user_id, chat_model, brief_provider, brief_model)
    VALUES (v_b, 'x', 'bogus-provider', 'y');
  EXCEPTION WHEN OTHERS THEN v_sqlstate := SQLSTATE;
  END;
  IF v_sqlstate IS DISTINCT FROM '23514' THEN
    RAISE EXCEPTION 'brief_provider inválido debía dar SQLSTATE 23514, dio %', v_sqlstate;
  END IF;

  -- ---- ningún intento fallido dejó fila para B ------------------------------
  SELECT count(*) INTO v_n FROM public.model_preferences WHERE user_id = v_b;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'B no debía tener fila en model_preferences tras los intentos fallidos';
  END IF;

  -- ---- trigger model_preferences_set_updated_at ------------------------------
  -- Dentro de esta transacción now() es constante, así que en vez de comparar
  -- timestamps antes/después se fuerza un valor absurdo y se comprueba que el
  -- trigger lo pisa en cualquier UPDATE, tal y como hace public.set_updated_at().
  UPDATE public.model_preferences
     SET updated_at = '2000-01-01T00:00:00Z'::timestamptz
   WHERE user_id = v_a;

  SELECT updated_at INTO v_ts FROM public.model_preferences WHERE user_id = v_a;
  IF v_ts = '2000-01-01T00:00:00Z'::timestamptz THEN
    RAISE EXCEPTION 'el trigger de updated_at no se disparó';
  END IF;

  -- ---- UPDATE normal de chat_model (lo que hará la app vía PATCH) ------------
  UPDATE public.model_preferences SET chat_model = 'openrouter/otro-modelo' WHERE user_id = v_a;

  SELECT count(*) INTO v_n
  FROM public.model_preferences
  WHERE user_id = v_a AND chat_model = 'openrouter/otro-modelo';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'no se pudo actualizar chat_model de la propia fila';
  END IF;

  -- ---- limpieza -----------------------------------------------------------
  DELETE FROM public.provider_credentials WHERE user_id IN (v_a, v_b);
  DELETE FROM public.model_preferences WHERE user_id IN (v_a, v_b);

  RAISE NOTICE 'proveedores y model_preferences: todas las comprobaciones en verde';
END;
$test$;
