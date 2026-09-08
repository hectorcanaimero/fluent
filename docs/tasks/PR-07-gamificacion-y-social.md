# PR-07 — Gamificación y social · rama `feat/juego` · SPEC-07

Sesión líder: Sonnet 5. Empieza cuando PR-01 esté fusionado. Gran parte de la lógica ya vive en SQL (PR-01/T3 y T5); este PR la expone y añade lo que falta.

## T1 · Servicio de progreso y niveles
- Modelo: Sonnet 5 · Depende de: PR-01/T3, PR-01/T6 · Bloquea a: PR-02/T7
- Alcance: `ProgressService`: niveles de XP de SPEC-07 §1 (`levelFor(xp)` con nombre, mínimo y siguiente), sesiones de la semana, tendencia de correcciones 30/7 días por categoría, estado de gracia ("disponible" / "usada").
- Aceptación: tests unitarios de `levelFor` en los límites; consulta de tendencia contra fixtures.
- Commit: `feat(juego): progreso, niveles y tendencia de correcciones`

## T2 · Desafíos cruzados
- Modelo: Sonnet 5 · Depende de: PR-01/T3 · Bloquea a: PR-02/T7, PR-04/T1 (`challengeFromUserId`)
- Alcance: `ChallengesService.listFor(userId)` según SPEC-07 §7; columna `sessions.challenge_from_user_id` añadida en una migración pequeña de este PR; `XP_CHALLENGE_BONUS` ya contemplado en `close_session` (verificar y ajustar la función si PR-01 no lo incluyó).
- Aceptación: test: máximo 3, uno por miembro, excluye temas practicados en 14 días y sesiones propias.
- Commit: `feat(juego): desafíos cruzados entre miembros`

## T3 · Boss battle y temas
- Modelo: Sonnet 5 · Depende de: PR-03/T6 · Bloquea a: PR-04/T1
- Alcance: `BossService`: `isPending(profile)`, `pickTopic(userId)` evitando usados, registro de rechazo del día en Redis (`boss:skip:<user>:<día>`).
- Aceptación: tests: pendiente en la sesión 7, 14; tras rechazar hoy no se ofrece hasta mañana; no repite tema.
- Commit: `feat(juego): boss battle cada siete sesiones`

## T4 · Leaderboard y streak grupal
- Modelo: Haiku 4.5 · Depende de: PR-01/T5 · Bloquea a: PR-02/T7
- Alcance: `LeaderboardService.week(groupId, weekStart)` sobre la RPC, cálculo de `weekStart` ISO y "días restantes"; lectura de `group_streak`.
- Aceptación: tests de `weekStart` en cambios de año y domingos.
- Commit: `feat(juego): leaderboard semanal y streak grupal`

## T5 · Documento de reglas para jugadores
- Modelo: Haiku 4.5 · Depende de: T1 a T4 · Bloquea a: nada
- Alcance: `docs/reglas.md` en español, para compartir con el grupo: cómo se gana XP, streaks, gracia, boss, desafíos, qué ven los demás de vos.
- Aceptación: revisión de la sesión líder contra SPEC-07.
- Commit: `docs: reglas del juego para el grupo`
