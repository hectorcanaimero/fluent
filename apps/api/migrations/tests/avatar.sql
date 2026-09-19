-- Test SQL de la foto de perfil (migración 20260919180000).
-- Ejecutar desde apps/api con:
--   ./scripts/run-sql-test.sh migrations/tests/avatar.sql
-- Requiere los usuarios de prueba: node scripts/db-test-users.ts
--
-- Si algo falla, el bloque lanza RAISE EXCEPTION y se revierte entero.

DO $test$
DECLARE
  v_a        uuid;
  v_b        uuid;
  v_profile  jsonb;
  v_url      text;
BEGIN
  SELECT id INTO v_a FROM auth.users WHERE email = 'sqltest-a@fluent.test';
  SELECT id INTO v_b FROM auth.users WHERE email = 'sqltest-b@fluent.test';
  IF v_a IS NULL OR v_b IS NULL THEN
    RAISE EXCEPTION 'faltan usuarios de prueba; ejecuta: node scripts/db-test-users.ts';
  END IF;

  DELETE FROM public.profiles WHERE user_id IN (v_a, v_b);
  SELECT profile INTO v_profile FROM auth.users WHERE id = v_a;

  -- ---- se copia la foto https del login social -----------------------------
  UPDATE auth.users
     SET profile = coalesce(profile, '{}'::jsonb)
                   || '{"avatar_url": "https://lh3.googleusercontent.com/a/test"}'
   WHERE id = v_a;
  INSERT INTO public.profiles (user_id, display_name, level) VALUES (v_a, 'Test A', 'A2');
  SELECT avatar_url INTO v_url FROM public.profiles WHERE user_id = v_a;
  IF v_url IS DISTINCT FROM 'https://lh3.googleusercontent.com/a/test' THEN
    RAISE EXCEPTION 'el perfil nuevo debía copiar la foto del login social, quedó %', v_url;
  END IF;

  -- ---- una URL que no es https se descarta ---------------------------------
  DELETE FROM public.profiles WHERE user_id = v_a;
  UPDATE auth.users
     SET profile = profile || '{"avatar_url": "http://inseguro.test/a.png"}'
   WHERE id = v_a;
  INSERT INTO public.profiles (user_id, display_name, level) VALUES (v_a, 'Test A', 'A2');
  SELECT avatar_url INTO v_url FROM public.profiles WHERE user_id = v_a;
  IF v_url IS NOT NULL THEN
    RAISE EXCEPTION 'una URL http no debía copiarse, quedó %', v_url;
  END IF;

  -- ---- sin foto queda null -------------------------------------------------
  INSERT INTO public.profiles (user_id, display_name, level) VALUES (v_b, 'Test B', 'A2');
  SELECT avatar_url INTO v_url FROM public.profiles WHERE user_id = v_b;
  IF v_url IS NOT NULL AND v_url NOT LIKE 'https://%' THEN
    RAISE EXCEPTION 'avatar inválido para B: %', v_url;
  END IF;

  -- ---- limpieza ------------------------------------------------------------
  DELETE FROM public.profiles WHERE user_id IN (v_a, v_b);
  UPDATE auth.users SET profile = v_profile WHERE id = v_a;

  RAISE NOTICE 'avatar: todas las comprobaciones en verde';
END;
$test$;
