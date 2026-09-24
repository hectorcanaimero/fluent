-- F5.1: fuera BYOK. Las credenciales de usuario (provider_credentials) y la
-- sesión de cortesía (MAL-24) dejan de existir: el LLM sale por 9router y el
-- plan decide qué modelos hay.
--
-- `profiles.courtesy_session_used_at` se deja: ya no se escribe ni se lee,
-- pero borrar columnas de `profiles` no era parte de este cambio.

DROP TABLE public.provider_credentials;

ALTER TABLE public.sessions DROP COLUMN courtesy;
