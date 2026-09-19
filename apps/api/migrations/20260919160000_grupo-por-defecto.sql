-- Grupo por defecto.
--
-- Con el login social ya no hay paso de código de invitación al registrarse,
-- pero practicar exige grupo (MEJ-33, `GROUP_REQUIRED`). Todo perfil nuevo
-- entra al grupo marcado con `is_default`; un código de invitación de un
-- amigo lo saca de ahí y lo lleva al grupo del amigo.
--
-- La migración no elige el grupo: mientras ninguno tenga `is_default`, el
-- trigger no hace nada. Se marca a mano (una sola vez) con:
--   UPDATE public.groups SET is_default = true WHERE id = '<grupo>';
--   UPDATE public.profiles SET group_id = '<grupo>' WHERE group_id IS NULL;

-- ---------------------------------------------------------------------------
-- 1. groups.is_default (a lo sumo uno)
-- ---------------------------------------------------------------------------
ALTER TABLE public.groups
  ADD COLUMN is_default boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX groups_single_default_idx
  ON public.groups (is_default) WHERE is_default;

-- ---------------------------------------------------------------------------
-- 2. Todo perfil nuevo sin grupo entra al grupo por defecto
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_default_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.group_id IS NULL THEN
    SELECT g.id INTO NEW.group_id FROM public.groups g WHERE g.is_default;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_default_group() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER profiles_assign_default_group
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_group();

-- ---------------------------------------------------------------------------
-- 3. redeem_invitation: estar en el grupo por defecto no cuenta como
--    ALREADY_IN_GROUP. Igual que la versión de 20260908171114 salvo ese IF.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_invitation(
  p_code    text,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user_id       uuid := coalesce(p_user_id, auth.uid());
  v_code          text := upper(btrim(coalesce(p_code, '')));
  v_current_group uuid;
  v_inv           public.invitations%ROWTYPE;
  v_group         public.groups%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT p.group_id INTO v_current_group
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  IF v_current_group IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.groups g WHERE g.id = v_current_group AND g.is_default
  ) THEN
    RAISE EXCEPTION 'ALREADY_IN_GROUP';
  END IF;

  SELECT * INTO v_inv
  FROM public.invitations i
  WHERE i.code = v_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITATION_INVALID';
  END IF;

  IF v_inv.used_by IS NOT NULL THEN
    RAISE EXCEPTION 'INVITATION_USED';
  END IF;

  IF v_inv.expires_at <= now() THEN
    RAISE EXCEPTION 'INVITATION_EXPIRED';
  END IF;

  UPDATE public.invitations
     SET used_by = v_user_id,
         used_at = now()
   WHERE code = v_code;

  UPDATE public.profiles
     SET group_id = v_inv.group_id
   WHERE user_id = v_user_id;

  SELECT * INTO v_group FROM public.groups g WHERE g.id = v_inv.group_id;

  RETURN jsonb_build_object(
    'group_id',     v_group.id,
    'name',         v_group.name,
    'group_streak', v_group.group_streak
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_invitation(text, uuid) FROM PUBLIC, anon, authenticated;
