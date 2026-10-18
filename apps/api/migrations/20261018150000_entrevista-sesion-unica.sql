-- F12.1.T2 · sesión única por entrevista (D5) y turnos de entrevista atómicos.
-- Cubre: specs/f12-entrevistas-entrevista-y-parecer.md#F12.1.T2.
--
-- 1. `interviews.resumable`: una entrevista `too_short` se puede retomar
--    (misma sesión) salvo que se agotara `INTERVIEW_MAX_SEC` o la cerrara el
--    sweeper; entonces la sesión ya está cerrada y `resumable = false`.
-- 2. `record_turn` suma parámetros opcionales para que la pregunta del plan
--    (`question_idx`/`is_follow_up`) y el tiempo activo (D4) se escriban en la
--    misma transacción que el turno del tutor. Con los defaults (NULL/0) los
--    llamadores de siempre no cambian. Se borra la firma vieja en vez de
--    sumar una sobrecarga: con dos firmas PostgREST no sabría cuál llamar.

ALTER TABLE public.interviews
  ADD COLUMN resumable boolean NOT NULL DEFAULT true;

DROP FUNCTION public.record_turn(uuid, int, text, text, int, int, int, int, jsonb);

CREATE FUNCTION public.record_turn(
  p_session_id       uuid,
  p_tutor_idx        int,
  p_text             text,
  p_model            text,
  p_tokens_in        int,
  p_tokens_out       int,
  p_latency_ms       int,
  p_turns_count      int,
  p_corrections      jsonb   DEFAULT '[]'::jsonb,
  p_question_idx     int     DEFAULT NULL,
  p_is_follow_up     boolean DEFAULT NULL,
  p_active_sec_delta int     DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_session public.sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_turn: la sesión % no existe', p_session_id;
  END IF;

  INSERT INTO public.turns (session_id, idx, role, text, model,
                            tokens_in, tokens_out, latency_ms,
                            question_idx, is_follow_up)
  VALUES (p_session_id, p_tutor_idx, 'tutor', p_text, p_model,
          p_tokens_in, p_tokens_out, p_latency_ms,
          p_question_idx, p_is_follow_up);

  -- `turn_idx` apunta al turno **del usuario**, que es el que se corrige.
  IF jsonb_array_length(p_corrections) > 0 THEN
    INSERT INTO public.corrections
      (session_id, user_id, turn_idx, original, corrected, category, note)
    SELECT
      p_session_id,
      v_session.user_id,
      (c->>'turn_idx')::int,
      c->>'original',
      c->>'corrected',
      c->>'category',
      c->>'note'
    FROM jsonb_array_elements(p_corrections) AS c;
  END IF;

  UPDATE public.sessions
     SET turns_count     = p_turns_count,
         chat_model_used = COALESCE(p_model, chat_model_used),
         active_sec      = active_sec + GREATEST(p_active_sec_delta, 0)
   WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'turns_count', p_turns_count,
    'active_sec', v_session.active_sec + GREATEST(p_active_sec_delta, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_turn(uuid, int, text, text, int, int, int, int, jsonb, int, boolean, int)
  FROM PUBLIC, anon, authenticated;
