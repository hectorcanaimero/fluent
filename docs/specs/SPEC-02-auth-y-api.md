# SPEC-02 — Auth y contrato de API

Estado: borrador v0.2 · Cubre: RF-1.x, RF-2.1 a RF-2.9, RF-8.x · ADR 0001, 0005

## 1. Identidad

- La app se registra e inicia sesión **directamente contra InsForge** por REST (no hay SDK Dart): `POST /api/auth/users?client_type=mobile` y `POST /api/auth/sessions?client_type=mobile`. Recibe `accessToken` (JWT, corto) y `refreshToken` (rotativo). Detalle en SPEC-06 §6.
- La API NestJS **no emite tokens**. Acepta el `accessToken` de InsForge en `Authorization: Bearer`.
- **Política de contraseña** (`apps/api/insforge.toml`, `[auth.password]`): mínimo **10 caracteres**, sin exigir mayúsculas, dígitos ni símbolos (MEJ-33). El archivo es la fuente de verdad, pero InsForge Cloud solo lo aplica cuando se despliega con su CLI: hasta entonces el proyecto sigue con el valor anterior. La verificación de email queda para P2 (cambia el alta en el móvil y exige configurar SMTP).

## 2. Verificación del token en la API

InsForge Cloud no publica el secreto JWT, así que la API verifica por introspección:

1. `AuthGuard` extrae el bearer.
2. Busca en caché (Redis, clave `auth:<sha256(token)>`, TTL 300 s) el `userId`.
3. Si no está, llama `GET {INSFORGE_URL}/api/auth/sessions/current` con ese bearer. 200 → cachea `user.id`; 401 → responde `401 UNAUTHENTICATED`.
4. Adjunta `req.user = { id }` y carga el perfil bajo demanda.

Coste: una llamada a InsForge por usuario cada 5 minutos como máximo. Si en el futuro InsForge expone JWKS o el secreto, se cambia el guard sin tocar el resto.

## 3. Acceso a datos desde la API

Cliente admin de `@insforge/sdk` (`createAdminClient` con `INSFORGE_API_KEY`) envuelto en un `InsforgeRepository` por agregado. Las operaciones con invariantes usan RPC (SPEC-01 §5). Nunca se construyen consultas con strings del usuario.

## 4. Endpoints

Base: `https://fluent-api.<host>/v1`. Todos requieren bearer salvo `/health`. Respuestas JSON en `camelCase`.

### 4.1 Cuenta y grupo (RF-1.x)
| Método y ruta | Cuerpo | Respuesta | Notas |
|---|---|---|---|
| GET `/me` | | `{ profile, group, plan: 'free'\|'pro', planExpiresAt: string\|null, modelPreference, onboarded, activeSessionId, interestsCatalog, pendingActions[] }` | primera llamada de la app. `pendingActions` avisa al owner, por ejemplo `weekly_summary_credential_missing` |
| PUT `/me/profile` | `{ displayName, level, interests[], timezone, locale }` | `profile` | valida 3 a 5 intereses del catálogo; `locale` en `es` o `pt-BR` |
| POST `/invitations/redeem` | `{ code }` | `{ group }` | RPC `redeem_invitation`; errores `INVITATION_INVALID`, `INVITATION_USED`, `INVITATION_EXPIRED`, `ALREADY_IN_GROUP` |
| POST `/admin/invitations` | `{ count?: 1..10 }` | `{ codes: [] }` | solo `owner_id` del grupo; RF-8.1 |
| POST `/groups/invitations` | — | `{ code, expiresAt }` | cualquier miembro, sin tope; sin grupo `GROUP_REQUIRED`; MEJ-41 y SPEC-07 §8.b |
| GET `/group` | | `{ group, members: [{userId, displayName, level, xp, streak, lastSessionDay}] }` | RF-6.5 |

### 4.2 Modelos y planes (RF-2.x)
| Método y ruta | Cuerpo | Respuesta | Notas |
|---|---|---|---|
| GET `/models` | | `{ providers: { '9router': { free: [], budget: [], premium: [] } }, estimatePerSession: { [modelId]: usd } }` | catálogo cacheado 6 h en Redis desde 9router, cruzado con lista fija del operador para tiers y precios (RF-2.9); `estimatePerSession` usa promedio real de tokens del usuario |
| PUT `/me/models` | `{ chatProvider: '9router', chatModel, briefProvider: '9router', briefModel }` | `modelPreference` | valida que el modelo esté en el catálogo; `403 PLAN_REQUIRED` si Free y algún modelo tiene tier ≠ free; `400 MODEL_NOT_AVAILABLE` si el id no existe |
| PUT `/admin/users/:id/plan` | `{ plan: 'free'\|'pro', expiresAt?: ISO 8601\|null }` | `{ userId, plan, planExpiresAt }` | solo `OWNER_USER_ID`; otro usuario `403 FORBIDDEN`; `404` si el usuario no existe |
| POST `/webhooks/revenuecat` | cabecera `Authorization: Bearer ${REVENUECAT_WEBHOOK_SECRET}` | `204` | escribe `plan` y `plan_expires_at` por `app_user_id = userId` (F4, RF-2.13) |

### 4.3 Sesiones (RF-3.x) — detalle de comportamiento en SPEC-04
| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| GET `/sessions/suggestions` | | `{ topics: [], roleplays: [{id,title}], news: [{id,title,source}] , bossPending: bool }` |
| POST `/sessions` | `{ kind, topic?, roleplayId?, newsItemId? }` | `{ session, opening: { text, callbackUsed } }` |
| POST `/sessions/:id/turns` | `{ text }` | `{ turnIdx, reply, corrections: [], modelUsed, degraded: bool }` |
| POST `/sessions/:id/turns/stream` | `{ text }` | SSE: eventos `token`, `corrections`, `done` (RF-3.8, P1) |
| POST `/sessions/:id/end` | `{ reason: 'timer'|'user' }` | `{ summary: { xpEarned, streak, isDoubleDay, correctionsCount, durationSec, nextIsBoss } }` |
| GET `/sessions` | `?limit&cursor` | `{ items: [session], nextCursor }` |

**Grupo obligatorio para practicar (MEJ-33).** `POST /sessions` exige que el perfil tenga `group_id`; si no, `422 GROUP_REQUIRED` («Unite a un grupo con tu código de invitación para practicar.»). Se comprueba antes que la sesión activa, la credencial y el `kind`, así que también cierra la sesión de cortesía (SPEC-04 §3.1): sin grupo no hay owner del que tomar prestada la key. La invitación deja así de gatear solo el grupo y pasa a gatear el uso.
| GET `/sessions/:id` | | `{ session, turns: [], corrections: [] }` |

### 4.4 Memoria (RF-4.x)
| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| GET `/memory` | | `{ facts: { pending: [], confirmed: [] }, brief: { text, levelHint, recurringErrors, updatedAt } }` |
| PATCH `/memory/facts/:id` | `{ status: 'confirmed'|'dismissed', text? }` | `fact` |
| DELETE `/memory/facts/:id` | | `204` |
| PUT `/memory/brief` | `{ text }` | `brief` (máx 600) |
| DELETE `/memory` | | `204` — borra hechos, brief e historial |

La app también puede hacer estas operaciones directamente contra InsForge gracias a las políticas RLS; se ofrecen en la API para que el cliente tenga una sola base URL. Decisión: **la app usa la API** para todo salvo auth.

### 4.5 Social y progreso (RF-5.x, RF-6.x)
| Método y ruta | Respuesta |
|---|---|
| GET `/progress` | `{ xp, level: {name, min, next}, streak, longestStreak, sessionsThisWeek, correctionsTrend: [{category, count30d, count7d}] }` |
| GET `/leaderboard?week=` | `{ weekStart, rows: [{userId, displayName, xpWeek, sessionsWeek, streak}], groupStreak }` |
| GET `/challenges` | `{ items: [{fromUserId, displayName, topic, kind, sessionId}] }` — RF-6.4 |
| GET `/weekly-summary?week=` | `{ text, weekStart }` o `404 NOT_READY` |

### 4.6 Sistema
| Método y ruta | Respuesta |
|---|---|
| GET `/health` | `{ ok, version, redis, insforge }` sin auth |
| GET `/admin/metrics` | RF-8.2, solo owner: sesiones por día 14 d, duración media, tasa de fallo LLM, jobs pendientes |
| PUT `/admin/users/:id/plan` | `{ plan: 'free'\|'pro', expiresAt?: ISO 8601\|null }` → `{ userId, plan, planExpiresAt }`; solo owner (`403`), `404` si el usuario no existe |

## 5. Códigos de error

| Código | HTTP | Cuándo |
|---|---|---|
| UNAUTHENTICATED | 401 | token ausente o inválido |
| FORBIDDEN | 403 | recurso de otro usuario o acción de owner |
| PLAN_REQUIRED | 403 | usuario Free elige modelo con tier ≠ free |
| NOT_ONBOARDED | 409 | falta perfil o grupo para la acción |
| VALIDATION | 400 | DTO inválido; `details[]` con campo y motivo |
| INVITATION_INVALID / USED / EXPIRED | 400 | |
| ALREADY_IN_GROUP | 409 | |
| MODEL_NOT_AVAILABLE | 400 | modelo fuera del catálogo |
| SESSION_NOT_ACTIVE | 409 | turno sobre sesión cerrada |
| SESSION_ALREADY_ACTIVE | 409 | intenta abrir otra con una activa; respuesta incluye `activeSessionId` |
| LLM_UNAVAILABLE | 503 | agotada la cadena de fallback |
| RATE_LIMITED | 429 | ver §6 |
| CHALLENGE_NOT_AVAILABLE | 422 | `challengeFromUserId` que no corresponde a un desafío ofrecido (SPEC-07 §7) |
| GROUP_REQUIRED | 422 | la acción exige pertenecer a un grupo y el perfil no tiene `group_id` (MEJ-33) |
| TURNS_DAILY_CAP | 429 | tope diario de turnos alcanzado; respuesta con `Retry-After` y `retryAfter` |
| NOT_READY | 404 | resumen semanal aún no generado |
| NOT_FOUND | 404 | ruta o recurso inexistente |
| INTERNAL | 500 | error no controlado; sin detalles en producción |

## 6. Límites

- 60 peticiones por minuto por usuario en general; 20 por minuto en `/sessions/:id/turns`.
- Un turno como máximo cada 2 segundos por sesión.
- Cuerpo de turno: 1 a 1 000 caracteres.
- **Tope diario de turnos** por plan (`TURNS_DAILY_CAP_FREE = 30`, `TURNS_DAILY_CAP_PRO = 120`; `0` desactiva): contador en Redis `turns:day:<userId>:<YYYY-MM-DD>` por **día natural del usuario** según `profiles.timezone`, no UTC. Al pasarse, `429 TURNS_DAILY_CAP` con la cabecera `Retry-After` y el campo `retryAfter` en el cuerpo, ambos con los segundos que faltan para su medianoche. Se comprueba antes de insertar el turno y antes de llamar al modelo, así que un turno rechazado no escribe nada. Con Redis caído se deja pasar (fail-open), igual que el lock de turno.
- El turno de conversación usa **2 intentos** máximo (`TURN_MAX_ATTEMPTS = 2`): el aprendiz espera delante de la pantalla y dos intentos de 25 s son 50 s de silencio. El brief y el resumen semanal, que corren en el worker, mantienen 3.

## 8. Validación y documentación

- DTOs con `class-validator` y `class-transformer`; `ValidationPipe` global con `whitelist: true`.
- OpenAPI generado con `@nestjs/swagger` y publicado en `/v1/docs` solo cuando `NODE_ENV != production` o con bearer de owner.
- Cada endpoint tiene un test e2e que cubre el camino feliz y el primer error listado.
