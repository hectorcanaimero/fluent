-- MEJ-25: `record_turn`, una sola transacción para todo lo que se escribe
-- después de la respuesta del modelo.
--
-- Antes eran tres escrituras encadenadas en la ruta caliente del turno —el
-- turno del tutor, sus correcciones y el UPDATE de la sesión— cada una con su
-- ida y vuelta a InsForge y ninguna atómica: si fallaba la segunda, quedaba un
-- turno del tutor sin correcciones y con `turns_count` desfasado, y el
-- historial de la siguiente llamada salía mal.
--
-- Devuelve `turns_count` ya actualizado para que quien llama no tenga que
-- releerlo.

CREATE OR REPLACE FUNCTION public.record_turn(
  p_session_id     uuid,
  p_tutor_idx      int,
  p_text           text,
  p_model          text,
  p_tokens_in      int,
  p_tokens_out     int,
  p_latency_ms     int,
  p_turns_count    int,
  p_corrections    jsonb DEFAULT '[]'::jsonb
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
                            tokens_in, tokens_out, latency_ms)
  VALUES (p_session_id, p_tutor_idx, 'tutor', p_text, p_model,
          p_tokens_in, p_tokens_out, p_latency_ms);

  -- Las correcciones llegan como JSON para no necesitar un tipo compuesto ni
  -- N parámetros. `turn_idx` apunta al turno **del usuario**, que es el que
  -- se está corrigiendo.
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
         chat_model_used = COALESCE(p_model, chat_model_used)
   WHERE id = p_session_id;

  RETURN jsonb_build_object('turns_count', p_turns_count);
END;
$$;

REVOKE ALL ON FUNCTION public.record_turn(uuid, int, text, text, int, int, int, int, jsonb)
  FROM PUBLIC, anon, authenticated;
