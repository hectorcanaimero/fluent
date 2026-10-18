-- F12.1.T2 · turnos de entrevista: a qué pregunta del plan corresponde cada
-- turno y si es una repregunta.
-- Cubre: specs/f12-entrevistas-entrevista-y-parecer.md#F12.1.T2.
--
-- `TurnsService` impone «una repregunta por pregunta» y el parecer
-- (F12.3.T1) manda el transcript con `questionIdx`: los dos necesitan saberlo
-- por turno y no hay otra columna donde guardarlo. Nulas fuera de
-- `kind = 'interview'`; las escribe la API después de `record_turn`.

ALTER TABLE public.turns
  ADD COLUMN question_idx smallint CHECK (question_idx BETWEEN 1 AND 8),
  ADD COLUMN is_follow_up boolean;
