# SPEC-01 — Modelo de datos

Estado: borrador v0.1 · Cubre: RF-1.x, RF-2.2, RF-3.4, RF-4.x, RF-5.x, RF-6.x, RF-7.1 · ADR 0001

## 1. Dónde vive

Postgres de InsForge Cloud, esquema `public`. Las migraciones se versionan en `apps/api/migrations/` con el formato `<timestamp>_<nombre>.sql` y se aplican con `npx @insforge/cli db migrations up`. InsForge Cloud no expone conexión directa a Postgres, así que:

- La **app móvil** lee y escribe solo lo que las políticas RLS le permiten, con el token del usuario.
- La **API NestJS** usa el cliente admin de InsForge (API key) y, para operaciones con invariantes, funciones SQL `SECURITY DEFINER` invocadas por RPC (`/api/database/rpc/<fn>`). Así las reglas de XP y streak viven en un solo sitio y son atómicas.

## 2. Tablas

### 2.1 `profiles` — uno por usuario
| Columna | Tipo | Notas |
|---|---|---|
| user_id | uuid PK, FK auth.users(id) ON DELETE CASCADE | |
| group_id | uuid FK groups(id) | null hasta que canjea invitación |
| display_name | text NOT NULL | 2 a 30 caracteres |
| level | text NOT NULL | CHECK IN ('A2','B1','B2') |
| interests | text[] NOT NULL DEFAULT '{}' | 3 a 5 tags al terminar onboarding |
| timezone | text NOT NULL DEFAULT 'America/Sao_Paulo' | IANA |
| locale | text NOT NULL DEFAULT 'es' | CHECK IN ('es','pt-BR'); idioma de UI y de las notas de corrección |
| xp | int NOT NULL DEFAULT 0 | acumulado total |
| streak | int NOT NULL DEFAULT 0 | días consecutivos |
| longest_streak | int NOT NULL DEFAULT 0 | |
| last_session_day | date | en zona del usuario |
| grace_used_week | date | lunes de la semana en que usó el día de gracia |
| sessions_count | int NOT NULL DEFAULT 0 | para boss battle cada N |
| onboarded_at | timestamptz | null hasta completar onboarding |
| created_at, updated_at | timestamptz NOT NULL DEFAULT now() | |

### 2.2 `groups`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| owner_id | uuid FK auth.users(id) | el operador |
| group_streak | int NOT NULL DEFAULT 0 | |
| created_at | timestamptz | |

### 2.3 `invitations`
| Columna | Tipo | Notas |
|---|---|---|
| code | text PK | 8 caracteres, alfabeto sin ambigüedad (sin 0/O/1/I) |
| group_id | uuid FK groups(id) | |
| created_by | uuid FK auth.users(id) | |
| used_by | uuid FK auth.users(id) | null si libre |
| used_at | timestamptz | |
| expires_at | timestamptz NOT NULL | 14 días por defecto |

### 2.4 `provider_credentials` — RF-2.2
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK auth.users(id) ON DELETE CASCADE | |
| provider | text NOT NULL | CHECK IN ('openrouter','gemini') |
| key_ciphertext | bytea NOT NULL | AES-256-GCM, ver SPEC-02 §5 |
| key_iv | bytea NOT NULL | 12 bytes |
| key_tag | bytea NOT NULL | 16 bytes |
| status | text NOT NULL DEFAULT 'active' | CHECK IN ('active','revoked','error') |
| last_error | text | |
| connected_at | timestamptz NOT NULL DEFAULT now() | |
| UNIQUE (user_id, provider) | | |

**RLS:** ninguna política para `authenticated`. Solo la API con rol admin lee y escribe. La app nunca ve esta tabla.

### 2.5 `model_preferences` — RF-2.6, RF-2.7
| Columna | Tipo | Notas |
|---|---|---|
| user_id | uuid PK FK auth.users(id) ON DELETE CASCADE | |
| chat_provider | text NOT NULL DEFAULT 'openrouter' | |
| chat_model | text NOT NULL | id del modelo en el proveedor |
| brief_provider | text NOT NULL DEFAULT 'openrouter' | |
| brief_model | text NOT NULL | |
| updated_at | timestamptz | |

### 2.6 `sessions`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK auth.users(id) ON DELETE CASCADE | |
| kind | text NOT NULL | CHECK IN ('free_topic','roleplay','news','boss') |
| topic | text NOT NULL | tema, escenario o titular |
| news_item_id | uuid FK news_items(id) | solo kind='news' |
| status | text NOT NULL DEFAULT 'active' | CHECK IN ('active','ended','abandoned') |
| started_at | timestamptz NOT NULL DEFAULT now() | |
| ended_at | timestamptz | |
| duration_sec | int | calculado al cerrar |
| turns_count | int NOT NULL DEFAULT 0 | turnos del usuario |
| xp_earned | int NOT NULL DEFAULT 0 | |
| chat_model_used | text | último modelo que respondió |
| callback_fact_id | uuid FK facts(id) | hecho usado en la apertura, si hubo |
| brief_job_status | text NOT NULL DEFAULT 'pending' | CHECK IN ('pending','running','done','failed') |

Índices: `(user_id, started_at desc)`, `(status)` parcial donde status='active'.

### 2.7 `turns`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| session_id | uuid FK sessions(id) ON DELETE CASCADE | |
| idx | int NOT NULL | 0 = apertura del tutor; luego pares usuario/tutor |
| role | text NOT NULL | CHECK IN ('user','tutor') |
| text | text NOT NULL | |
| model | text | solo role='tutor' |
| tokens_in, tokens_out | int | solo role='tutor' |
| latency_ms | int | solo role='tutor' |
| created_at | timestamptz NOT NULL DEFAULT now() | |
| UNIQUE (session_id, idx) | | |

### 2.8 `corrections` — RF-3.4, RF-4.7
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| session_id | uuid FK sessions(id) ON DELETE CASCADE | |
| user_id | uuid FK auth.users(id) | desnormalizado para consultas de tendencia |
| turn_idx | int NOT NULL | turno del usuario corregido |
| original | text NOT NULL | |
| corrected | text NOT NULL | |
| category | text NOT NULL | ver catálogo §4 |
| note | text | en español, máx 140 caracteres |
| created_at | timestamptz | |

Índice: `(user_id, category, created_at desc)`.

### 2.9 `facts` — RF-4.1 a RF-4.6
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK auth.users(id) ON DELETE CASCADE | |
| text | text NOT NULL | en inglés, máx 160 caracteres, tercera persona |
| happens_on | date | fecha del evento, si aplica |
| status | text NOT NULL DEFAULT 'pending' | CHECK IN ('pending','confirmed','dismissed') |
| source_session_id | uuid FK sessions(id) ON DELETE SET NULL | |
| last_used_at | timestamptz | última apertura en la que se usó |
| use_count | int NOT NULL DEFAULT 0 | |
| created_at, updated_at | timestamptz | |

Índice: `(user_id, status)`.

### 2.10 `coaching_briefs` — RF-4.5
| Columna | Tipo | Notas |
|---|---|---|
| user_id | uuid PK FK auth.users(id) ON DELETE CASCADE | |
| text | text NOT NULL | máx 600 caracteres, inglés |
| level_hint | text | CHECK IN ('A2','B1','B2') |
| recurring_errors | jsonb NOT NULL DEFAULT '[]' | `[{category, example}]`, máx 5 |
| source_session_id | uuid | |
| updated_at | timestamptz | |

Histórico: tabla `coaching_brief_history` con las mismas columnas más `id` y sin PK en user_id, para estudiar la evolución. Se inserta una fila por cada actualización.

### 2.11 `news_items` — RF-7.1
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| source | text NOT NULL | nombre del feed |
| url | text NOT NULL UNIQUE | |
| title | text NOT NULL | |
| summary | text | primeros 400 caracteres limpios |
| tags | text[] NOT NULL DEFAULT '{}' | del catálogo de intereses |
| published_at | timestamptz | |
| day | date NOT NULL | día de ingesta, UTC |

Retención: 14 días. Índice `(day desc)`, GIN en `tags`.

### 2.12 `weekly_summaries` — RF-6.3
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| group_id | uuid FK groups(id) | |
| week_start | date NOT NULL | lunes |
| text | text NOT NULL | español, listo para WhatsApp |
| stats | jsonb NOT NULL | lo que se le pasó al modelo |
| created_at | timestamptz | |
| UNIQUE (group_id, week_start) | | |

### 2.13 `xp_events` — auditoría
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | |
| session_id | uuid | |
| kind | text NOT NULL | 'session','duration_bonus','double_day','boss','challenge' |
| amount | int NOT NULL | |
| created_at | timestamptz | |

Toda modificación de `profiles.xp` pasa por `xp_events`. Permite recalcular y depurar.

### 2.14 `llm_calls` — observabilidad
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | |
| session_id | uuid | |
| purpose | text NOT NULL | 'turn','brief','weekly' |
| provider, model | text | |
| tokens_in, tokens_out | int | |
| latency_ms | int | |
| status | text NOT NULL | 'ok','invalid_json','provider_error','rate_limited','fallback','auth_error','no_credits','timeout' |
| prompt_version | int NOT NULL DEFAULT 1 | versión del prompt usado (SPEC-03 §4) |
| attempt | int NOT NULL DEFAULT 1 | |
| created_at | timestamptz | |

Retención 90 días. Nunca guarda el contenido del prompt.

## 3. Políticas RLS

Principio: la app móvil solo toca lo que es del usuario, y solo en lectura salvo lo que se lista. Todo lo que cambia estado con reglas pasa por la API.

| Tabla | SELECT (authenticated) | INSERT/UPDATE desde app | Notas |
|---|---|---|---|
| profiles | propia fila, más `display_name, level, xp, streak, group_id` de miembros del mismo grupo (vista `group_members`) | UPDATE propia fila solo columnas `display_name, level, interests, timezone, locale` | RF-6.5 |
| groups | la del propio grupo | ninguno | |
| invitations | ninguna | ninguno | solo API |
| provider_credentials | ninguna | ninguno | solo API |
| model_preferences | propia | UPDATE propia | catálogo lo valida la API |
| sessions | propias | ninguno | |
| turns | de sesiones propias | ninguno | |
| corrections | propias | ninguno | |
| facts | propias | UPDATE propia: `status`, `text`; DELETE propia | RF-4.2, RF-4.6 |
| coaching_briefs | propio | UPDATE propio: `text`; DELETE propio | RF-4.6 |
| news_items | todas | ninguno | |
| weekly_summaries | del propio grupo | ninguno | |
| xp_events, llm_calls | ninguna | ninguno | solo API |

Vista `group_members` (SECURITY INVOKER) expone de `profiles` solo `user_id, display_name, level, xp, streak, last_session_day, group_id` filtrando por el grupo del usuario actual.

## 4. Catálogo de categorías de corrección

`past_simple, present_perfect, articles, prepositions, word_order, subject_verb, plurals, vocabulary, pronunciation_hint, false_friend, phrasal_verb, conditional, modal, other`. El prompt de SPEC-03 exige una de estas; cualquier otra se mapea a `other`.

## 5. Funciones RPC (SECURITY DEFINER, search_path fijado)

| Función | Parámetros | Qué hace | Quién la llama |
|---|---|---|---|
| `redeem_invitation(code)` | text | Valida código libre y no expirado, asigna `group_id` al perfil, marca usado. Atómica. | API |
| `close_session(session_id, duration_sec, turns_count)` | | Marca `ended`, calcula XP según SPEC-07, inserta `xp_events`, actualiza `xp`, `streak`, `last_session_day`, `sessions_count` con la zona horaria del perfil. Devuelve `{xp_earned, streak, is_double_day, next_is_boss}`. | API |
| `pick_callback_fact(user_id)` | | Elige un hecho `confirmed` no usado en la última sesión, prioriza los que tienen `happens_on` reciente. Actualiza `last_used_at`, `use_count`. Devuelve la fila o null. | API |
| `weekly_leaderboard(group_id, week_start)` | | XP ganado en la semana por miembro, ordenado. | app y API |
| `apply_streak_grace()` | | Job diario: a quien no practicó ayer y no usó gracia esta semana, se la aplica en lugar de resetear. | worker |

Las reglas numéricas están en SPEC-07 y se implementan en SQL con los mismos nombres de constante, que la migración recibe como literales documentados.

## 6. Migraciones

1. `0001_extensions_y_grupos.sql` — groups, invitations, profiles, vista group_members, trigger de `updated_at`.
2. `0002_proveedores.sql` — provider_credentials, model_preferences.
3. `0003_sesiones.sql` — sessions, turns, corrections, xp_events, llm_calls, `close_session`.
4. `0004_memoria.sql` — facts, coaching_briefs, coaching_brief_history, `pick_callback_fact`.
5. `0005_contenido_y_social.sql` — news_items, weekly_summaries, `weekly_leaderboard`, `apply_streak_grace`.

Cada migración incluye sus políticas RLS y GRANTs. Se prueban primero en una rama de InsForge (`branch create`) y se fusionan.
