-- SPEC-01 §6 migración 4 · memoria: hechos y coaching brief
-- Cubre: SPEC-01 §2.9 (facts), §2.10 (coaching_briefs y coaching_brief_history),
--        §3 (RLS), §5 (`pick_callback_fact`) y SPEC-05 §2 paso 4 (`apply_brief`).
-- Decisiones fuera de spec: docs/specs/PENDIENTES.md.

-- ---------------------------------------------------------------------------
-- 1. Normalización de hechos
--    SPEC-05 §2 paso 4 descarta los hechos con "la misma cadena normalizada:
--    minúsculas, sin puntuación". Aquí está esa normalización, en un solo
--    sitio, para que `apply_brief` y el índice usen exactamente la misma.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_fact_text(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT btrim(regexp_replace(lower(p_text), '[^[:alnum:]]+', ' ', 'g'));
$$;

REVOKE ALL ON FUNCTION public.normalize_fact_text(text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. facts (SPEC-01 §2.9, RF-4.1 a RF-4.6)
-- ---------------------------------------------------------------------------
CREATE TABLE public.facts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text              text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 160),
  happens_on        date,
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'confirmed', 'dismissed')),
  source_session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  last_used_at      timestamptz,
  use_count         int NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX facts_user_status_idx ON public.facts (user_id, status);
CREATE INDEX facts_user_normalized_idx
  ON public.facts (user_id, public.normalize_fact_text(text));

CREATE TRIGGER facts_set_updated_at
  BEFORE UPDATE ON public.facts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- La FK que la migración 3 no pudo declarar todavía (SPEC-01 §2.6).
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_callback_fact_id_fkey
  FOREIGN KEY (callback_fact_id) REFERENCES public.facts(id) ON DELETE SET NULL;

CREATE INDEX sessions_callback_fact_idx ON public.sessions (callback_fact_id);

-- ---------------------------------------------------------------------------
-- 3. coaching_briefs y su histórico (SPEC-01 §2.10, RF-4.5)
-- ---------------------------------------------------------------------------
CREATE TABLE public.coaching_briefs (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  text              text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 600),
  level_hint        text CHECK (level_hint IN ('A2', 'B1', 'B2')),
  recurring_errors  jsonb NOT NULL DEFAULT '[]'::jsonb
                      CHECK (jsonb_typeof(recurring_errors) = 'array'
                             AND jsonb_array_length(recurring_errors) <= 5),
  source_session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER coaching_briefs_set_updated_at
  BEFORE UPDATE ON public.coaching_briefs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Mismas columnas que coaching_briefs más `id`, sin PK en user_id: una fila
-- por cada actualización, para estudiar la evolución.
CREATE TABLE public.coaching_brief_history (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text              text NOT NULL,
  level_hint        text,
  recurring_errors  jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  updated_at        timestamptz NOT NULL
);

CREATE INDEX coaching_brief_history_user_idx
  ON public.coaching_brief_history (user_id, updated_at DESC);

-- ---------------------------------------------------------------------------
-- 4. RLS y GRANTs (SPEC-01 §3)
-- ---------------------------------------------------------------------------

-- facts: la app lee los suyos, cambia `status` y `text`, y puede borrarlos.
ALTER TABLE public.facts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.facts FROM anon, authenticated;
GRANT SELECT, DELETE ON public.facts TO authenticated;
GRANT UPDATE (status, text) ON public.facts TO authenticated;

CREATE POLICY facts_select_own ON public.facts
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY facts_update_own ON public.facts
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY facts_delete_own ON public.facts
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- coaching_briefs: la app lo lee, edita solo `text` y puede borrarlo (RF-4.6).
ALTER TABLE public.coaching_briefs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coaching_briefs FROM anon, authenticated;
GRANT SELECT, DELETE ON public.coaching_briefs TO authenticated;
GRANT UPDATE (text) ON public.coaching_briefs TO authenticated;

CREATE POLICY coaching_briefs_select_own ON public.coaching_briefs
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY coaching_briefs_update_own ON public.coaching_briefs
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY coaching_briefs_delete_own ON public.coaching_briefs
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- coaching_brief_history: material de estudio, no lo expone la app.
-- SPEC-01 §3 no le da fila en la tabla de políticas. Ver PENDIENTES.
ALTER TABLE public.coaching_brief_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coaching_brief_history FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. pick_callback_fact (SPEC-01 §5, RF-4.4)
--    Elige un hecho `confirmed` que no sea el usado la última vez, priorizando
--    los que tienen `happens_on` cerca de hoy y los menos usados. Marca el uso
--    y devuelve la fila como jsonb, o NULL si no hay ninguno.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pick_callback_fact(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_fact       public.facts%ROWTYPE;
  v_last_id    uuid;
  v_candidates int;
BEGIN
  SELECT count(*) INTO v_candidates
  FROM public.facts f
  WHERE f.user_id = p_user_id AND f.status = 'confirmed';

  IF v_candidates = 0 THEN
    RETURN NULL;
  END IF;

  -- El hecho usado más recientemente se descarta, salvo que sea el único.
  IF v_candidates > 1 THEN
    SELECT f.id INTO v_last_id
    FROM public.facts f
    WHERE f.user_id = p_user_id
      AND f.status = 'confirmed'
      AND f.last_used_at IS NOT NULL
    ORDER BY f.last_used_at DESC, f.id
    LIMIT 1;
  END IF;

  SELECT * INTO v_fact
  FROM public.facts f
  WHERE f.user_id = p_user_id
    AND f.status = 'confirmed'
    AND (v_last_id IS NULL OR f.id <> v_last_id)
  ORDER BY
    (f.happens_on IS NULL),                    -- primero los que tienen fecha
    abs(f.happens_on - current_date),          -- la más cercana a hoy
    f.last_used_at NULLS FIRST,                -- luego los que nunca se usaron
    f.use_count,
    f.created_at,
    f.id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- clock_timestamp() y no now(): dos llamadas dentro de la misma transacción
  -- tendrían el mismo now() y "el último usado" dejaría de estar definido.
  UPDATE public.facts
     SET last_used_at = clock_timestamp(),
         use_count    = use_count + 1
   WHERE id = v_fact.id
  RETURNING * INTO v_fact;

  RETURN to_jsonb(v_fact);
END;
$$;

REVOKE ALL ON FUNCTION public.pick_callback_fact(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. apply_brief (SPEC-05 §2 paso 4)
--    Transacción del job coaching-brief: archiva el brief anterior, hace
--    upsert del nuevo, inserta los hechos como `pending` descartando los que
--    ya existen con la misma cadena normalizada, y marca la sesión como
--    `brief_job_status = 'done'`.
--    `p_facts` es un array jsonb de `{ text, happens_on }`.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_brief(
  p_session_id       uuid,
  p_brief            text,
  p_level_hint       text DEFAULT NULL,
  p_recurring_errors jsonb DEFAULT '[]'::jsonb,
  p_facts            jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  c_brief_max_chars constant int := 600;   -- RF-4.5
  c_fact_max_chars  constant int := 160;   -- SPEC-01 §2.9
  c_max_errors      constant int := 5;     -- SPEC-01 §2.10

  v_session   public.sessions%ROWTYPE;
  v_user_id   uuid;
  v_prev      public.coaching_briefs%ROWTYPE;
  v_brief     text;
  v_errors    jsonb;
  v_fact      jsonb;
  v_fact_text text;
  v_norm      text;
  v_inserted  int := 0;
  v_skipped   int := 0;
BEGIN
  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;
  v_user_id := v_session.user_id;

  -- Idempotencia: el job puede reintentarse (SPEC-05 §1).
  IF v_session.brief_job_status = 'done' THEN
    RETURN jsonb_build_object('applied', false, 'facts_inserted', 0, 'facts_skipped', 0);
  END IF;

  v_brief := left(btrim(coalesce(p_brief, '')), c_brief_max_chars);
  IF v_brief = '' THEN
    RAISE EXCEPTION 'BRIEF_EMPTY';
  END IF;

  v_errors := coalesce(p_recurring_errors, '[]'::jsonb);
  IF jsonb_typeof(v_errors) <> 'array' THEN
    v_errors := '[]'::jsonb;
  END IF;
  IF jsonb_array_length(v_errors) > c_max_errors THEN
    SELECT coalesce(jsonb_agg(e.value), '[]'::jsonb) INTO v_errors
    FROM (
      SELECT value FROM jsonb_array_elements(v_errors) WITH ORDINALITY AS t(value, ord)
      ORDER BY ord LIMIT c_max_errors
    ) AS e;
  END IF;

  -- 1. Archivar el brief anterior.
  SELECT * INTO v_prev FROM public.coaching_briefs WHERE user_id = v_user_id;
  IF FOUND THEN
    INSERT INTO public.coaching_brief_history
      (user_id, text, level_hint, recurring_errors, source_session_id, updated_at)
    VALUES
      (v_prev.user_id, v_prev.text, v_prev.level_hint, v_prev.recurring_errors,
       v_prev.source_session_id, v_prev.updated_at);
  END IF;

  -- 2. Upsert del brief nuevo.
  INSERT INTO public.coaching_briefs
    (user_id, text, level_hint, recurring_errors, source_session_id, updated_at)
  VALUES
    (v_user_id, v_brief, p_level_hint, v_errors, p_session_id, now())
  ON CONFLICT (user_id) DO UPDATE
    SET text              = EXCLUDED.text,
        level_hint        = EXCLUDED.level_hint,
        recurring_errors  = EXCLUDED.recurring_errors,
        source_session_id = EXCLUDED.source_session_id,
        updated_at        = now();

  -- 3. Hechos nuevos como `pending`, sin duplicar cadenas ya conocidas.
  FOR v_fact IN
    SELECT value FROM jsonb_array_elements(coalesce(p_facts, '[]'::jsonb))
  LOOP
    v_fact_text := left(btrim(coalesce(v_fact ->> 'text', '')), c_fact_max_chars);
    v_norm := public.normalize_fact_text(v_fact_text);

    IF v_fact_text = '' OR v_norm = '' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.facts f
      WHERE f.user_id = v_user_id
        AND public.normalize_fact_text(f.text) = v_norm
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.facts (user_id, text, happens_on, status, source_session_id)
    VALUES (v_user_id, v_fact_text,
            nullif(v_fact ->> 'happens_on', '')::date, 'pending', p_session_id);
    v_inserted := v_inserted + 1;
  END LOOP;

  -- 4. La sesión ya tiene su brief.
  UPDATE public.sessions SET brief_job_status = 'done' WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'applied',        true,
    'facts_inserted', v_inserted,
    'facts_skipped',  v_skipped
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_brief(uuid, text, text, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
