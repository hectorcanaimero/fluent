-- Planes Free/Pro. Solo la API (clave admin) escribe estas columnas.
--
-- profiles concede a `authenticated` SELECT de tabla y UPDATE solo de cinco
-- columnas (display_name, level, interests, timezone, locale), así que
-- `plan` y `plan_expires_at` nacen sin UPDATE para el usuario; el REVOKE
-- lo deja explícito y protege ante un GRANT amplio futuro.
ALTER TABLE public.profiles
  ADD COLUMN plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  ADD COLUMN plan_expires_at timestamptz;

REVOKE UPDATE (plan, plan_expires_at) ON public.profiles FROM anon, authenticated;
