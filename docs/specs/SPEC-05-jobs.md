# SPEC-05 — Jobs en background (BullMQ)

Estado: borrador v0.1 · Cubre: RF-4.1, RF-4.7, RF-5.2, RF-6.2, RF-6.3, RF-7.1 · ADR 0001

## 1. Infraestructura

- Redis como recurso de Coolify, base de datos 0 para colas y 1 para caché.
- El worker es el mismo paquete `@fluent/api` arrancado con `node dist/worker.js`. Comparte módulos y configuración. Concurrencia por cola en la tabla.
- Prefijo de claves `fluent:`.
- Todos los jobs son idempotentes: reciben ids, no datos, y comprueban el estado antes de actuar.

| Cola | Job | Disparador | Concurrencia | Reintentos |
|---|---|---|---|---|
| `brief` | coaching-brief | `POST /sessions/:id/end` | 3 | 3, backoff exponencial 30 s |
| `content` | rss-ingest | cron diario 06:00 UTC | 1 | 2 |
| `social` | weekly-summary | cron lunes 07:00 UTC | 1 | 3 |
| `maintenance` | session-sweeper | cron cada minuto | 1 | 0 |
| `maintenance` | daily-streaks | cron diario 03:30 UTC | 1 | 1 |
| `maintenance` | retention | cron diario 04:00 UTC | 1 | 1 |
| `maintenance` | model-catalog | cron cada 6 h | 1 | 2 |

## 2. coaching-brief (RF-4.1, RF-4.5, RF-4.7)

Entrada: `{ sessionId }`.

1. Cargar sesión; si `brief_job_status = 'done'` salir. Marcar `running`.
2. Cargar turnos, brief actual, hechos `confirmed` y `pending` del usuario, preferencias de modelo para el rol `brief`.
3. Llamar `LlmClient` con prompt SPEC-03 §4.2 y schema `BriefOutput`.
4. Transacción vía RPC `apply_brief(session_id, brief, level_hint, recurring_errors, facts[])`:
   - Insertar en `coaching_brief_history` el brief anterior.
   - Upsert `coaching_briefs`.
   - Insertar `facts` como `pending`, descartando los que tengan similitud trivial con existentes (misma cadena normalizada: minúsculas, sin puntuación).
   - Marcar sesión `brief_job_status='done'`.
5. Si falla el LLM tras la cadena: `failed`; BullMQ reintenta. Tras 3 fallos queda `failed` y la app no muestra nada; la siguiente sesión del usuario vuelve a encolar el job para la última sesión `failed` si tiene menos de 3 días. El marcado lo hace el listener `@OnWorkerEvent('failed')` del processor, y solo cuando `attemptsMade` alcanza el `attempts` de la cola: BullMQ emite ese evento en **cada** intento, y actuar antes daría por definitivo un fallo del que todavía se va a reintentar. El reencolado va en `openSession`, sin bloquear la apertura y sin propagar errores de la cola, y es idempotente por `jobId = sessionId`.

Regla de nivel: si `level_hint` difiere del `profile.level` en tres briefs consecutivos, se guarda `profiles.suggested_level` y la app pregunta al usuario si quiere cambiarlo. El nivel nunca cambia solo.

## 3. rss-ingest (RF-7.1)

Fuentes en `apps/api/src/content/feeds.json`: `{ name, url, tags[] , lang:'en' }`. Iniciales: BBC World, BBC Technology, The Guardian Football, Ars Technica, NPR Science, ESPN Soccer, The Verge, NASA Breaking News. Todas en inglés para que el disparador y la conversación sean en el idioma objetivo.

1. Para cada feed: descargar con timeout 10 s y un tope de 2 MB por respuesta (se lee por trozos y se aborta al pasarse, sin fiarse del `Content-Length` que anuncia el servidor), parsear (`rss-parser`), tomar los 15 más recientes. Todas las URLs son `https`. Un feed que falle por cualquiera de los dos topes cuenta como fallo y los demás siguen.
2. Por ítem: `url` única; `summary` = descripción sin HTML recortada a 400 caracteres; `tags` = los del feed más palabras clave del catálogo de intereses encontradas en el título.
3. Upsert en `news_items` con `day = hoy`.
4. Borrar ítems con `day < hoy - 14`.

Sin llamadas al LLM.

## 4. weekly-summary (RF-6.3)

Entrada: `{ groupId, weekStart }` (lunes de la semana que acaba de terminar).

1. Si existe fila en `weekly_summaries` salir.
2. `stats` por miembro con `weekly_leaderboard` más top 3 temas por miembro, `groupStreak`.
3. Elegir credencial: la del **owner del grupo** para el rol `brief` (una llamada por grupo y semana, RF-6.3). Si el owner no tiene credencial activa, marcar `failed` y avisar al owner por `GET /me` (`pendingActions`).
4. `LlmClient` con SPEC-03 §4.3, añadir el pie de marca de SPEC-07 §8 al texto (lo pone el código, no el prompt) y guardar `text` y `stats`.

Se encola un job por grupo el lunes 07:00 UTC.

## 5. session-sweeper

Cada minuto: sesiones `active` con `started_at < now - SESSION_HARD_CAP_SEC` → cerrar como en SPEC-04 §5 con `reason:'timer'`. Sesiones `active` sin turnos de usuario en `ABANDON_AFTER_SEC` → según SPEC-04 §6.

## 6. daily-streaks (RF-5.2, RF-6.2)

A las 03:30 UTC (todas las zonas del grupo ya cambiaron de día para America/*, y para Europa es madrugada):

1. RPC `apply_streak_grace()`: por perfil, calcular "ayer" en su zona. Si `last_session_day < ayer`:
   - si `grace_used_week != lunes_actual` y `last_session_day = anteayer`: usar gracia (`grace_used_week = lunes_actual`), streak intacto.
   - si no: `streak = 0`.
2. Streak grupal: si todos los miembros con `onboarded_at` no nulo y actividad en los últimos 14 días tienen `last_session_day ≥ ayer`, `group_streak += 1`; si no, `0`.

## 7. retention

- `llm_calls` > 90 días: borrar.
- `news_items` > 14 días: borrar.
- `turns` de sesiones > 365 días: borrar (se conservan `sessions` y `corrections` para estadísticas).
- Tokens de PKCE y locks caducados los gestiona el TTL de Redis.

## 8. model-catalog (RF-2.6)

Descarga `GET https://openrouter.ai/api/v1/models` sin auth, calcula tiers según SPEC-03 §7 y guarda en Redis `catalog:openrouter` con TTL 7 h. Si falla, se conserva el anterior.

## 9. Observabilidad

- Cada job loguea `{ job, id, durationMs, result }` en JSON.
- `GET /admin/metrics` expone conteo por cola: waiting, active, failed (BullMQ `getJobCounts`).
- Bull Board en `/admin/queues` solo con bearer de owner (P1).
