-- Foto de perfil del login social.
--
-- Quien entra con Google tiene su foto en auth.users.profile->>'avatar_url'.
-- Se copia a profiles.avatar_url al crear el perfil (trigger) para no
-- consultar InsForge en cada GET /me. Si el usuario cambia la foto en Google
-- después, acá queda la anterior.

ALTER TABLE public.profiles
  ADD COLUMN avatar_url text
  CHECK (avatar_url IS NULL OR avatar_url ~ '^https://');

-- Solo URLs https: cualquier otra cosa se descarta en vez de romper el alta.
CREATE OR REPLACE FUNCTION public.copy_auth_avatar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_url text;
BEGIN
  IF NEW.avatar_url IS NULL THEN
    SELECT u.profile ->> 'avatar_url' INTO v_url
    FROM auth.users u
    WHERE u.id = NEW.user_id;
    IF v_url ~ '^https://' THEN
      NEW.avatar_url := v_url;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.copy_auth_avatar() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER profiles_copy_auth_avatar
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.copy_auth_avatar();

-- Perfiles que ya existían.
UPDATE public.profiles p
   SET avatar_url = u.profile ->> 'avatar_url'
  FROM auth.users u
 WHERE u.id = p.user_id
   AND p.avatar_url IS NULL
   AND u.profile ->> 'avatar_url' ~ '^https://';
