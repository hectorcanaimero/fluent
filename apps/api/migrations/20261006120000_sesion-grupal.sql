-- F6.1.T1 · esquema de la sala grupal por texto.
-- Cubre: docs/arch/002-sesion-grupal.md §Data model, specs/f6-sala-grupal-texto.md#F6.1.T1.
-- `close_group_session` queda para F9.1 (migración 20261006130000).

-- ---------------------------------------------------------------------------
-- 1. group_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE public.group_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  initiator_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('free_topic', 'roleplay', 'news')),
  topic           text,
  roleplay_id     text,
  news_item_id    uuid REFERENCES public.news_items(id),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  end_reason      text CHECK (end_reason IN ('initiator', 'max_duration', 'idle')),
  started_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  warned_at       timestamptz,          -- aviso de 25 min ya emitido
  recap           jsonb                 -- GroupRecapOutput (F9.2)
);

-- FR-4: como mucho una sala activa por grupo.
CREATE UNIQUE INDEX group_sessions_one_active
  ON public.group_sessions (group_id) WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- 2. group_session_participants
-- ---------------------------------------------------------------------------
CREATE TABLE public.group_session_participants (
  session_id        uuid NOT NULL REFERENCES public.group_sessions(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at         timestamptz NOT NULL DEFAULT now(),
  left_at           timestamptz,                          -- null = activo
  present_sec       int NOT NULL DEFAULT 0 CHECK (present_sec >= 0),
  share_corrections boolean NOT NULL DEFAULT false,        -- FR-12
  messages_count    int NOT NULL DEFAULT 0 CHECK (messages_count >= 0),
  PRIMARY KEY (session_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 3. group_session_messages
-- ---------------------------------------------------------------------------
CREATE TABLE public.group_session_messages (
  id           bigserial PRIMARY KEY,   -- también es el orden y el cursor
  session_id   uuid NOT NULL REFERENCES public.group_sessions(id) ON DELETE CASCADE,
  role         text NOT NULL CHECK (role IN ('user', 'tutor', 'system')),
  author_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- null para tutor y sistema
  text         text NOT NULL,           -- en una nota de voz, la transcripción
  audio_key    text,                    -- F8; se pone a null tras 30 días
  audio_ms     int CHECK (audio_ms IS NULL OR audio_ms >= 0),
  system_event text CHECK (system_event IN
                 ('joined', 'left', 'ending_soon', 'ended', 'tutor_unavailable')),
  model        text,
  tokens_in    int,
  tokens_out   int,
  latency_ms   int,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK ((role = 'system') = (system_event IS NOT NULL))
);

CREATE INDEX group_session_messages_session_id_idx
  ON public.group_session_messages (session_id, id);

-- ---------------------------------------------------------------------------
-- 4. group_session_corrections
-- ---------------------------------------------------------------------------
CREATE TABLE public.group_session_corrections (
  id         bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.group_sessions(id) ON DELETE CASCADE,
  message_id bigint NOT NULL REFERENCES public.group_session_messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- autor del mensaje corregido
  original   text NOT NULL,
  corrected  text NOT NULL,
  category   text NOT NULL CHECK (category IN (
               'past_simple', 'present_perfect', 'articles', 'prepositions',
               'word_order', 'subject_verb', 'plurals', 'vocabulary',
               'pronunciation_hint', 'false_friend', 'phrasal_verb',
               'conditional', 'modal', 'other')),
  note       text CHECK (note IS NULL OR char_length(note) <= 140)
);

CREATE INDEX group_session_corrections_session_idx
  ON public.group_session_corrections (session_id);

-- ---------------------------------------------------------------------------
-- 5. sessions / xp_events: `'group'` como kind nuevo (F9.1 lo usa al cerrar).
-- ---------------------------------------------------------------------------
ALTER TABLE public.sessions
  ADD COLUMN group_session_id uuid REFERENCES public.group_sessions(id) ON DELETE SET NULL;

ALTER TABLE public.sessions
  DROP CONSTRAINT sessions_kind_check;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_kind_check
  CHECK (kind IN ('free_topic', 'roleplay', 'news', 'boss', 'group'));

ALTER TABLE public.xp_events
  DROP CONSTRAINT xp_events_kind_check;

ALTER TABLE public.xp_events
  ADD CONSTRAINT xp_events_kind_check
  CHECK (kind IN ('session', 'duration_bonus', 'double_day',
                  'boss', 'challenge', 'streak_7', 'profile_completed', 'group'));

-- ---------------------------------------------------------------------------
-- 6. RLS: igual que xp_events, solo la API con rol admin accede.
-- ---------------------------------------------------------------------------
ALTER TABLE public.group_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.group_sessions FROM anon, authenticated;

ALTER TABLE public.group_session_participants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.group_session_participants FROM anon, authenticated;

ALTER TABLE public.group_session_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.group_session_messages FROM anon, authenticated;

ALTER TABLE public.group_session_corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.group_session_corrections FROM anon, authenticated;
