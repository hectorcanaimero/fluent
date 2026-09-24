-- Proveedor único 9router · limpieza de preferencias de modelo
-- Ref: docs/arch/001-9router-y-planes.md
-- Migración posterior a 20260908190234_proveedores-y-preferencias-de-modelo.sql.
--
-- No crea tablas, así que no hay REVOKE/GRANT nuevos: los de model_preferences
-- (SELECT y UPDATE de columnas para `authenticated`, RLS activada) no cambian.

-- ---------------------------------------------------------------------------
-- 1. model_preferences: 9router pasa a ser el único proveedor
--    Se quitan los CHECK de proveedor (nombres por defecto de Postgres), se
--    reescriben todas las filas y se vuelven a crear los CHECK ya restringidos.
-- ---------------------------------------------------------------------------
ALTER TABLE public.model_preferences
  DROP CONSTRAINT model_preferences_chat_provider_check,
  DROP CONSTRAINT model_preferences_brief_provider_check;

UPDATE public.model_preferences
   SET chat_provider  = '9router',
       brief_provider = '9router',
       chat_model     = 'fluent-free',
       brief_model    = 'fluent-free';

ALTER TABLE public.model_preferences
  ALTER COLUMN chat_provider  SET DEFAULT '9router',
  ALTER COLUMN brief_provider SET DEFAULT '9router',
  ADD CONSTRAINT model_preferences_chat_provider_check
    CHECK (chat_provider IN ('9router')),
  ADD CONSTRAINT model_preferences_brief_provider_check
    CHECK (brief_provider IN ('9router'));

-- ---------------------------------------------------------------------------
-- 2. provider_credentials: las claves de usuario ya no se usan
--    Se vacía la tabla; se elimina por completo en F5.
-- ---------------------------------------------------------------------------
DELETE FROM public.provider_credentials;
