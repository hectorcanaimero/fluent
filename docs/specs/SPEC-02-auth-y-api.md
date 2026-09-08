# SPEC-02 — Auth y contrato de API

Estado: borrador v0.1 · Cubre: RF-1.x, RF-2.1 a RF-2.9, RF-8.x · ADR 0001, 0002

## 1. Identidad

- La app se registra e inicia sesión **directamente contra InsForge** por REST (no hay SDK Dart): `POST /api/auth/users?client_type=mobile` y `POST /api/auth/sessions?client_type=mobile`. Recibe `accessToken` (JWT, corto) y `refreshToken` (rotativo). Detalle en SPEC-06 §6.
- La API NestJS **no emite tokens**. Acepta el `accessToken` de InsForge en `Authorization: Bearer`.

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
| GET `/me` | | `{ profile, group, providers: [{provider,status,connectedAt}], modelPreference, onboarded }` | primera llamada de la app |
| PUT `/me/profile` | `{ displayName, level, interests[], timezone, locale }` | `profile` | valida 3 a 5 intereses del catálogo; `locale` en `es` o `pt-BR` |
| POST `/invitations/redeem` | `{ code }` | `{ group }` | RPC `redeem_invitation`; errores `INVITATION_INVALID`, `INVITATION_USED`, `INVITATION_EXPIRED`, `ALREADY_IN_GROUP` |
| POST `/admin/invitations` | `{ count?: 1..10 }` | `{ codes: [] }` | solo `owner_id` del grupo; RF-8.1 |
| GET `/group` | | `{ group, members: [{userId, displayName, level, xp, streak, lastSessionDay}] }` | RF-6.5 |

### 4.2 Proveedores y modelos (RF-2.x)
| Método y ruta | Cuerpo | Respuesta | Notas |
|---|---|---|---|
| POST `/providers/openrouter/pkce/start` | `{ callbackUrl }` | `{ authUrl, codeVerifierId }` | la API genera y guarda el `code_verifier` en Redis 10 min; la app abre `authUrl` |
| POST `/providers/openrouter/pkce/complete` | `{ code, codeVerifierId }` | `{ provider: 'openrouter', status }` | la API canjea el código en `https://openrouter.ai/api/v1/auth/keys` y cifra la key |
| POST `/providers/gemini` | `{ apiKey }` | `{ provider: 'gemini', status }` | la API valida con una llamada a `/models` antes de guardar; error `PROVIDER_KEY_INVALID` |
| DELETE `/providers/:provider` | | `204` | borra la credencial y resetea preferencias que la usaban |
| GET `/providers/:provider/status` | | `{ status, lastError, credits? }` | para OpenRouter consulta `GET /api/v1/credits` y devuelve `{ total, used }` (RF-2.3) |
| GET `/models` | | `{ providers: { openrouter: { free: [], budget: [], premium: [] }, gemini: { free: [] } }, estimatePerSession: { [modelId]: usd } }` | catálogo cacheado 6 h en Redis; tiers y estimación en SPEC-03 §7 |
| PUT `/me/models` | `{ chatProvider, chatModel, briefProvider, briefModel }` | `modelPreference` | valida que exista credencial activa del proveedor y que el modelo esté en el catálogo |

### 4.3 Sesiones (RF-3.x) — detalle de comportamiento en SPEC-04
| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| GET `/sessions/suggestions` | | `{ topics: [], roleplays: [{id,title}], news: [{id,title,source}] , bossPending: bool }` |
| POST `/sessions` | `{ kind, topic?, roleplayId?, newsItemId? }` | `{ session, opening: { text, callbackUsed } }` |
| POST `/sessions/:id/turns` | `{ text }` | `{ turnIdx, reply, corrections: [], modelUsed, degraded: bool }` |
| POST `/sessions/:id/turns/stream` | `{ text }` | SSE: eventos `token`, `corrections`, `done` (RF-3.8, P1) |
| POST `/sessions/:id/end` | `{ reason: 'timer'|'user' }` | `{ summary: { xpEarned, streak, isDoubleDay, correctionsCount, durationSec, nextIsBoss } }` |
| GET `/sessions` | `?limit&cursor` | `{ items: [session], nextCursor }` |
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

## 5. Cifrado de credenciales (RF-2.2)

- Clave maestra `CREDENTIALS_MASTER_KEY` (32 bytes, base64) en variables de entorno de Coolify.
- AES-256-GCM, IV aleatorio de 12 bytes por registro, AAD = `user_id:provider`.
- Descifrado solo en memoria dentro del `LlmClient`, nunca se loguea ni se serializa.
- Rotación: variable `CREDENTIALS_MASTER_KEY_PREVIOUS` permite recifrar en un job de mantenimiento.

## 6. Códigos de error

| Código | HTTP | Cuándo |
|---|---|---|
| UNAUTHENTICATED | 401 | token ausente o inválido |
| FORBIDDEN | 403 | recurso de otro usuario o acción de owner |
| NOT_ONBOARDED | 409 | falta perfil o grupo para la acción |
| VALIDATION | 400 | DTO inválido; `details[]` con campo y motivo |
| INVITATION_INVALID / USED / EXPIRED | 400 | |
| ALREADY_IN_GROUP | 409 | |
| PROVIDER_NOT_CONNECTED | 409 | intenta sesión sin credencial activa |
| PROVIDER_KEY_INVALID | 400 | |
| MODEL_NOT_AVAILABLE | 400 | modelo fuera del catálogo o sin credencial |
| SESSION_NOT_ACTIVE | 409 | turno sobre sesión cerrada |
| SESSION_ALREADY_ACTIVE | 409 | intenta abrir otra con una activa; respuesta incluye `activeSessionId` |
| LLM_UNAVAILABLE | 503 | agotada la cadena de fallback (RF-2.5) |
| RATE_LIMITED | 429 | ver §7 |
| NOT_READY | 404 | resumen semanal aún no generado |

## 7. Límites

- 60 peticiones por minuto por usuario en general; 20 por minuto en `/sessions/:id/turns`.
- Un turno como máximo cada 2 segundos por sesión.
- Cuerpo de turno: 1 a 1 000 caracteres.

## 8. Validación y documentación

- DTOs con `class-validator` y `class-transformer`; `ValidationPipe` global con `whitelist: true`.
- OpenAPI generado con `@nestjs/swagger` y publicado en `/v1/docs` solo cuando `NODE_ENV != production` o con bearer de owner.
- Cada endpoint tiene un test e2e que cubre el camino feliz y el primer error listado.
