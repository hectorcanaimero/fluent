-- SPEC-01 §6 migración 1 · grupos, invitaciones, perfiles
-- Cubre: SPEC-01 §2.1 (profiles), §2.2 (groups), §2.3 (invitations),
--        §3 (RLS y vista group_members), §5 (redeem_invitation).
-- Notas de diseño fuera de spec anotadas en docs/specs/PENDIENTES.md.
--
-- InsForge concede por defecto SELECT/INSERT/UPDATE/DELETE a `anon` y
-- `authenticated` sobre cada tabla nueva de `public` y NO activa RLS.
-- Por eso cada tabla revoca todo y vuelve a conceder solo lo permitido.

-- ---------------------------------------------------------------------------
-- 1. Trigger genérico de updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. groups (SPEC-01 §2.2)
-- ---------------------------------------------------------------------------
CREATE TABLE public.groups (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  -- owner_id nullable + SET NULL: borrar la cuenta del operador (RNF privacidad)
  -- no debe bloquearse por el grupo. PENDIENTES §1.
  owner_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  group_streak int NOT NULL DEFAULT 0 CHECK (group_streak >= 0),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX groups_owner_id_idx ON public.groups (owner_id);

-- ---------------------------------------------------------------------------
-- 3. profiles (SPEC-01 §2.1 + suggested_level de SPEC-05 §2)
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  user_id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id        uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  display_name    text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 30),
  level           text NOT NULL CHECK (level IN ('A2', 'B1', 'B2')),
  -- suggested_level: lo escribe el job coaching-brief (SPEC-05 §2). El nivel
  -- nunca cambia solo; la app pregunta.
  suggested_level text CHECK (suggested_level IN ('A2', 'B1', 'B2')),
  interests       text[] NOT NULL DEFAULT '{}',
  timezone        text NOT NULL DEFAULT 'America/Sao_Paulo',
  locale          text NOT NULL DEFAULT 'es' CHECK (locale IN ('es', 'pt-BR')),
  xp              int NOT NULL DEFAULT 0 CHECK (xp >= 0),
  streak          int NOT NULL DEFAULT 0 CHECK (streak >= 0),
  longest_streak  int NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  last_session_day date,                      -- en zona horaria del perfil
  grace_used_week date,                       -- lunes de la semana con gracia usada
  sessions_count  int NOT NULL DEFAULT 0 CHECK (sessions_count >= 0),
  onboarded_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX profiles_group_id_idx ON public.profiles (group_id);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. invitations (SPEC-01 §2.3)
-- ---------------------------------------------------------------------------
CREATE TABLE public.invitations (
  -- 8 caracteres, alfabeto sin ambigüedad: sin 0, O, 1 ni I.
  code       text PRIMARY KEY CHECK (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  group_id   uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at    timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  CHECK ((used_by IS NULL) = (used_at IS NULL))
);

CREATE INDEX invitations_group_id_idx ON public.invitations (group_id);

-- ---------------------------------------------------------------------------
-- 5. Helper de RLS: grupo del usuario actual
--    SECURITY DEFINER para no reentrar en la RLS de profiles (access-control).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_group_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT p.group_id FROM public.profiles p WHERE p.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_group_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_group_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. RLS y GRANTs (SPEC-01 §3)
-- ---------------------------------------------------------------------------

-- profiles: la app ve solo su fila y actualiza solo cinco columnas.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (display_name, level, interests, timezone, locale)
  ON public.profiles TO authenticated;

CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- groups: solo el propio grupo, solo lectura.
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.groups FROM anon, authenticated;
GRANT SELECT ON public.groups TO authenticated;

CREATE POLICY groups_select_own ON public.groups
  FOR SELECT TO authenticated
  USING (id = public.current_group_id());

-- invitations: invisible para la app; solo la API con rol admin.
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invitations FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Vista group_members (SPEC-01 §3, RF-6.5)
--    Proyección pública de profiles: expone de los compañeros de grupo solo
--    las columnas visibles. Se deja como vista SECURITY DEFINER (por defecto,
--    dueño project_admin) porque la RLS de profiles limita a la fila propia y
--    una vista SECURITY INVOKER no podría mostrar a los demás miembros.
--    El filtrado por grupo lo hace el WHERE. PENDIENTES §2.
-- ---------------------------------------------------------------------------
CREATE VIEW public.group_members AS
SELECT
  p.user_id,
  p.display_name,
  p.level,
  p.xp,
  p.streak,
  p.last_session_day,
  p.group_id
FROM public.profiles p
WHERE p.group_id IS NOT NULL
  AND p.group_id = public.current_group_id();

REVOKE ALL ON public.group_members FROM anon, authenticated;
GRANT SELECT ON public.group_members TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. RPC redeem_invitation (SPEC-01 §5, SPEC-02 §3)
--    p_user_id opcional: la API la llama con la clave admin (auth.uid() nulo)
--    y pasa el id del usuario; desde un token de usuario basta el código.
--    PENDIENTES §3.
--    Errores: INVITATION_INVALID, INVITATION_USED, INVITATION_EXPIRED,
--             ALREADY_IN_GROUP, PROFILE_NOT_FOUND, UNAUTHENTICATED.
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

  IF v_current_group IS NOT NULL THEN
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
