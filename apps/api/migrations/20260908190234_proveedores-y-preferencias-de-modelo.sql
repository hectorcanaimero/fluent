-- SPEC-01 §6 migración 2 · proveedores y preferencias de modelo
-- Cubre: SPEC-01 §2.4 (provider_credentials), §2.5 (model_preferences), §3 (RLS).
-- Notas de diseño fuera de spec anotadas en docs/specs/PENDIENTES.md.
--
-- InsForge concede por defecto SELECT/INSERT/UPDATE/DELETE a `anon` y
-- `authenticated` sobre cada tabla nueva de `public` y NO activa RLS.
-- Por eso cada tabla revoca todo y vuelve a conceder solo lo permitido.
-- Reutiliza public.set_updated_at(), creada en la migración 1.

-- ---------------------------------------------------------------------------
-- 1. provider_credentials (SPEC-01 §2.4)
--    RLS activada y SIN ninguna política para `authenticated`: la app nunca
--    ve esta tabla ni por SELECT ni por escritura. Solo la API, con la clave
--    admin (rol project_admin, que no pasa por RLS ni por estos GRANTs),
--    lee y escribe las credenciales cifradas.
-- ---------------------------------------------------------------------------
CREATE TABLE public.provider_credentials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider        text NOT NULL CHECK (provider IN ('openrouter', 'gemini')),
  key_ciphertext  bytea NOT NULL,          -- AES-256-GCM, ver SPEC-02 §5
  key_iv          bytea NOT NULL,          -- 12 bytes
  key_tag         bytea NOT NULL,          -- 16 bytes
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'revoked', 'error')),
  last_error      text,
  connected_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

-- La UNIQUE (user_id, provider) ya crea un índice cuyo primer campo es
-- user_id; cubre las búsquedas de la API por usuario sin índice adicional.

ALTER TABLE public.provider_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.provider_credentials FROM anon, authenticated;
-- Sin GRANT ni CREATE POLICY para anon/authenticated: ninguna fila es
-- alcanzable desde un token de usuario, ni siquiera de forma vacía por RLS
-- (ya lo impide el REVOKE, RLS es la segunda barrera).

-- ---------------------------------------------------------------------------
-- 2. model_preferences (SPEC-01 §2.5, RF-2.6, RF-2.7)
--    La app lee y actualiza su propia fila; solo la API (clave admin) crea o
--    borra filas, típicamente al terminar el onboarding o al desconectar un
--    proveedor. Decisión fuera de spec (PENDIENTES §9): se añade el mismo
--    CHECK de proveedor que provider_credentials en chat_provider y
--    brief_provider, para que la columna nunca contenga un proveedor que la
--    API no sepa resolver.
-- ---------------------------------------------------------------------------
CREATE TABLE public.model_preferences (
  user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_provider  text NOT NULL DEFAULT 'openrouter'
                   CHECK (chat_provider IN ('openrouter', 'gemini')),
  chat_model     text NOT NULL,            -- id del modelo en el proveedor
  brief_provider text NOT NULL DEFAULT 'openrouter'
                   CHECK (brief_provider IN ('openrouter', 'gemini')),
  brief_model    text NOT NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- user_id ya es PK (índice propio); es la única columna que usan las
-- políticas de abajo, así que no hace falta un índice adicional.

CREATE TRIGGER model_preferences_set_updated_at
  BEFORE UPDATE ON public.model_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.model_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.model_preferences FROM anon, authenticated;
GRANT SELECT ON public.model_preferences TO authenticated;
-- INSERT y DELETE quedan fuera: la API crea la fila con la clave admin al
-- terminar el onboarding y la borra si hace falta; la app solo actualiza.
GRANT UPDATE (chat_provider, chat_model, brief_provider, brief_model)
  ON public.model_preferences TO authenticated;

CREATE POLICY model_preferences_select_own ON public.model_preferences
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY model_preferences_update_own ON public.model_preferences
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
