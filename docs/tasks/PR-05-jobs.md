# PR-05 — Jobs en background · rama `feat/jobs` · SPEC-05

Sesión líder: Sonnet 5. Empieza cuando PR-01 y PR-03 estén fusionados. El worker arranca con `node dist/worker.js` (PR-08/T4).

## T1 · Infraestructura de colas y job `coaching-brief`
- Modelo: Opus 5 · Depende de: PR-08/T3, PR-01/T4, PR-03/T3, PR-03/T4 · Bloquea a: T2 a T6
- Alcance: `QueuesModule` con BullMQ (`@nestjs/bullmq`), colas de SPEC-05 §1 con concurrencia y reintentos, `JobDispatcher` real (interfaz de PR-04/T3); procesador `coaching-brief` según SPEC-05 §2 con `apply_brief` y la regla de `suggested_level`.
- Aceptación: test de integración con Redis real en Docker (`testcontainers`) y LLM simulado: job idempotente (dos ejecuciones, un solo historial); fallo del LLM → reintento con backoff.
- Commit: `feat(jobs): colas BullMQ y coaching brief post-sesión`

## T2 · `rss-ingest`
- Modelo: Sonnet 5 · Depende de: T1, PR-01/T5 · Bloquea a: sugerencias de noticias reales
- Alcance: `apps/api/src/content/feeds.json` (8 feeds de SPEC-05 §3), procesador con `rss-parser`, limpieza de HTML, tags por catálogo, upsert por `url`, retención 14 días, cron 06:00 UTC.
- Aceptación: test con 2 feeds guardados en fixtures; segunda ejecución no duplica; ítems viejos se borran.
- Commit: `feat(jobs): ingesta diaria de noticias por RSS`

## T3 · `weekly-summary`
- Modelo: Sonnet 5 · Depende de: T1, PR-01/T5 · Bloquea a: PR-02/T7 `weekly-summary` real
- Alcance: procesador según SPEC-05 §4 con credencial del owner y prompt `weekly`; cron lunes 07:00 UTC que encola un job por grupo; `pendingActions` en `/me` cuando el owner no tiene credencial (coordinar con PR-02: campo opcional ya previsto en el DTO).
- Aceptación: test: existe resumen → no llama al LLM; owner sin credencial → `failed` con motivo.
- Commit: `feat(jobs): resumen semanal del grupo`

## T4 · Mantenimiento: sweeper, streaks, retención, catálogo
- Modelo: Sonnet 5 · Depende de: T1, PR-04/T5, PR-01/T5, PR-03/T5 · Bloquea a: nada
- Alcance: crons de SPEC-05 §5 a §8 que llaman a `SessionSweeperService`, `apply_streak_grace`, borrados de retención y `CatalogService.refresh()`.
- Aceptación: test de que cada cron encola con la expresión correcta y que `retention` borra solo lo que toca (fixtures con fechas).
- Commit: `feat(jobs): mantenimiento diario y refresco del catálogo`

## T5 · Observabilidad de jobs
- Modelo: Haiku 4.5 · Depende de: T1 · Bloquea a: nada
- Alcance: logs JSON por job según SPEC-05 §9; `getJobCounts` expuesto a `GET /admin/metrics`; Bull Board en `/admin/queues` protegido por owner (P1).
- Aceptación: `admin/metrics` muestra las 4 colas; Bull Board responde 403 sin owner.
- Commit: `feat(jobs): métricas y panel de colas`
