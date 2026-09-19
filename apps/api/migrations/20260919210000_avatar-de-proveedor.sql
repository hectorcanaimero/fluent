-- Foto del login social también desde el proveedor vinculado.
--
-- Quien se registró con email y después entró con Google (mismo correo)
-- queda en su cuenta vieja: InsForge no copia la foto a auth.users.profile,
-- la deja en auth.user_providers.provider_data->>'avatar'. Esta función busca
-- en los dos lugares.

CREATE OR REPLACE FUNCTION public.auth_avatar_url(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT url
  FROM (
    SELECT u.profile ->> 'avatar_url' AS url, 0 AS pri, u.updated_at AS at
    FROM auth.users u
    WHERE u.id = p_user_id
    UNION ALL
    SELECT p.provider_data ->> 'avatar', 1, p.updated_at
    FROM auth.user_providers p
    WHERE p.user_id = p_user_id
  ) c
  WHERE url ~ '^https://'
  ORDER BY pri, at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.auth_avatar_url(uuid) FROM PUBLIC, anon, authenticated;

-- El trigger de alta de perfil (20260919180000) pasa a usar la función.
CREATE OR REPLACE FUNCTION public.copy_auth_avatar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.avatar_url IS NULL THEN
    NEW.avatar_url := public.auth_avatar_url(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Para quien vincula Google después de tener perfil: GET /me la llama si el
-- perfil todavía no tiene foto. Devuelve la foto (o null si no hay).
CREATE OR REPLACE FUNCTION public.refresh_avatar(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_url text := public.auth_avatar_url(p_user_id);
BEGIN
  IF v_url IS NOT NULL THEN
    UPDATE public.profiles
       SET avatar_url = v_url
     WHERE user_id = p_user_id
       AND avatar_url IS NULL;
  END IF;
  RETURN v_url;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_avatar(uuid) FROM PUBLIC, anon, authenticated;

-- Perfiles que ya existían.
UPDATE public.profiles
   SET avatar_url = public.auth_avatar_url(user_id)
 WHERE avatar_url IS NULL;
