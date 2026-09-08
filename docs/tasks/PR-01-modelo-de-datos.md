# PR-01 — Modelo de datos · rama `feat/datos` · SPEC-01

Sesión líder: Opus 5. Empieza ya en paralelo con PR-08; T1 se aplica a InsForge cuando PR-08/T2 exista. Toda la rama trabaja sobre una rama de InsForge `feat-datos`.

## T1 · Grupos, invitaciones y perfiles
- Modelo: Opus 5 · Depende de: nada (aplicar requiere PR-08/T2) · Bloquea a: PR-02/T2, PR-07
- Alcance: `apps/api/migrations/<ts>_grupos-invitaciones-perfiles.sql` con `groups`, `invitations`, `profiles` (incluida `suggested_level`), trigger `set_updated_at`, vista `group_members`, políticas RLS y GRANTs de SPEC-01 §3, función `redeem_invitation`.
- Aceptación: migración aplicada en la rama de InsForge sin error; script `apps/api/scripts/db-smoke.ts` crea dos usuarios de prueba vía REST, canjea una invitación y comprueba que el usuario A no lee el perfil completo del B pero sí la vista.
- Commit: `feat(db): grupos, invitaciones, perfiles y RLS`

## T2 · Proveedores y preferencias de modelo
- Modelo: Sonnet 5 · Depende de: T1 · Bloquea a: PR-02/T4
- Alcance: migración con `provider_credentials` (sin políticas para `authenticated`) y `model_preferences` (RLS propia). CHECKs de SPEC-01 §2.4 y §2.5.
- Aceptación: con token de usuario, `GET /api/database/records/provider_credentials` devuelve vacío o 403; `model_preferences` solo la propia.
- Commit: `feat(db): credenciales de proveedores y preferencias de modelo`

## T3 · Sesiones, turnos, correcciones y auditoría
- Modelo: Opus 5 · Depende de: T1 · Bloquea a: PR-04, PR-07/T1
- Alcance: migración con `sessions`, `turns`, `corrections`, `xp_events`, `llm_calls`, índices de SPEC-01, RLS de solo lectura propia. Función `close_session` implementando SPEC-07 §2 al pie de la letra, con las constantes como literales comentadas.
- Aceptación: test SQL en `apps/api/migrations/tests/close_session.sql` (se ejecuta con `db query`) que cubre: sesión corta sin XP, sesión válida con base y duración, segunda sesión del día con bonus, boss con multiplicador, cuarta sesión sin XP, streak de ayer +1, streak roto = 1, bonus al llegar a 7.
- Commit: `feat(db): sesiones, turnos, correcciones y close_session`

## T4 · Memoria: hechos y coaching brief
- Modelo: Opus 5 · Depende de: T3 · Bloquea a: PR-04/T2, PR-05/T1
- Alcance: migración con `facts`, `coaching_briefs`, `coaching_brief_history`, RLS con UPDATE limitado a `status, text` y DELETE propio; funciones `pick_callback_fact` y `apply_brief` (SPEC-05 §2 paso 4).
- Aceptación: test SQL: `pick_callback_fact` no devuelve el mismo hecho dos veces seguidas, prioriza `happens_on` próximo, ignora `pending`; `apply_brief` no duplica hechos con la misma cadena normalizada.
- Commit: `feat(db): hechos, coaching brief y funciones de memoria`

## T5 · Contenido y social
- Modelo: Sonnet 5 · Depende de: T3 · Bloquea a: PR-05/T2, PR-05/T3, PR-07/T3
- Alcance: migración con `news_items` (GIN en tags), `weekly_summaries`, funciones `weekly_leaderboard` y `apply_streak_grace` según SPEC-07 §5 y SPEC-05 §6.
- Aceptación: test SQL: leaderboard con empate resuelto por sesiones; gracia aplicada una sola vez por semana; streak grupal ignora miembros inactivos 14 días.
- Commit: `feat(db): noticias, resumen semanal, leaderboard y gracia de streak`

## T6 · Tipos TypeScript del esquema
- Modelo: Haiku 4.5 · Depende de: T1 a T5 · Bloquea a: PR-02, PR-04, PR-05, PR-07
- Alcance: `apps/api/src/db/schema.ts` con un `interface` por tabla (nombres `snake_case` como en SQL) y `apps/api/src/db/rpc.ts` con las firmas de las funciones RPC. Generado a mano a partir de las migraciones; comentario en cabecera con la migración de origen.
- Aceptación: `tsc --noEmit` en verde; revisión cruzada contra las migraciones por la sesión líder.
- Commit: `feat(api): tipos del esquema y firmas RPC`

## T7 · Fusionar rama de InsForge
- Modelo: Sonnet 5 · Depende de: aprobación del PR · Bloquea a: todos los PRs que leen datos reales
- Alcance: `branch merge feat-datos --dry-run`, revisar SQL, `branch merge`. Actualizar `docs/runbooks/insforge.md` con lo aprendido.
- Aceptación: `db migrations list` en el proyecto principal muestra las 5 migraciones.
- Commit: `chore(db): migraciones aplicadas al proyecto principal`
