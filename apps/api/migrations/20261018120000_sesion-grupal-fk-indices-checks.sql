-- Arreglos a la migración 20261006120000 (sala grupal, PR #71) tras la revisión.
-- Esa migración ya está aplicada; no se edita, se corrige hacia delante.

-- ---------------------------------------------------------------------------
-- 1. group_sessions.news_item_id: ON DELETE SET NULL, como sessions.news_item_id.
--    Sin esto, la purga diaria de rss-ingest (news_items con más de 14 días)
--    falla con 23503 en cuanto una sala grupal apunta a la noticia.
--    `group_sessions_news_item_id_fkey` es el nombre que puso Postgres al
--    declarar la FK en línea.
-- ---------------------------------------------------------------------------
ALTER TABLE public.group_sessions
  DROP CONSTRAINT group_sessions_news_item_id_fkey;

ALTER TABLE public.group_sessions
  ADD CONSTRAINT group_sessions_news_item_id_fkey
  FOREIGN KEY (news_item_id) REFERENCES public.news_items(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 2. Índices en las FK que no tenían (borrados en cascada y SET NULL sin
--    recorrer la tabla entera). `group_session_participants.session_id` ya lo
--    cubre la PK y `group_session_corrections.session_id` su propio índice.
-- ---------------------------------------------------------------------------
CREATE INDEX group_sessions_news_item_idx
  ON public.group_sessions (news_item_id);
CREATE INDEX group_sessions_initiator_idx
  ON public.group_sessions (initiator_id);
CREATE INDEX sessions_group_session_idx
  ON public.sessions (group_session_id);
CREATE INDEX group_session_participants_user_idx
  ON public.group_session_participants (user_id);
CREATE INDEX group_session_messages_author_idx
  ON public.group_session_messages (author_id);
CREATE INDEX group_session_corrections_message_idx
  ON public.group_session_corrections (message_id);
CREATE INDEX group_session_corrections_user_idx
  ON public.group_session_corrections (user_id);

-- ---------------------------------------------------------------------------
-- 3. Checks de coherencia en group_sessions, igual que en sessions:
--    - news_item_id solo con kind='news' (puede quedar null tras la purga).
--    - roleplay_id solo con kind='roleplay'.
--    - status='ended' si y solo si ended_at y end_reason están puestos
--      (close_group_session, F9.1, marca los tres a la vez; spec F6 §184).
-- ---------------------------------------------------------------------------
ALTER TABLE public.group_sessions
  ADD CONSTRAINT group_sessions_news_item_kind_check
  CHECK (kind = 'news' OR news_item_id IS NULL);

ALTER TABLE public.group_sessions
  ADD CONSTRAINT group_sessions_roleplay_kind_check
  CHECK (kind = 'roleplay' OR roleplay_id IS NULL);

ALTER TABLE public.group_sessions
  ADD CONSTRAINT group_sessions_ended_check
  CHECK ((status = 'ended') = (ended_at IS NOT NULL)
     AND (status = 'ended') = (end_reason IS NOT NULL));
