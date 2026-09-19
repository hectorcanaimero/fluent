-- Tokens de notificaciones push (Firebase Cloud Messaging).
--
-- Un token identifica una instalación de la app; si otro usuario inicia
-- sesión en el mismo teléfono, el token pasa a ese usuario (upsert por token).
-- Solo la API lo toca, con la clave admin.

CREATE TABLE public.push_tokens (
  token      text PRIMARY KEY CHECK (char_length(token) BETWEEN 10 AND 4096),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform   text NOT NULL CHECK (platform IN ('android', 'ios')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX push_tokens_user_idx ON public.push_tokens (user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_tokens FROM anon, authenticated;
