# SPEC-07 — Gamificación y social

Estado: borrador v0.1 · Cubre: RF-5.1 a RF-5.4, RF-6.1 a RF-6.5 · SPEC-01 §5, SPEC-05 §6

## 1. Constantes (`config/product.ts` y literales en `close_session`)

| Nombre | Valor |
|---|---|
| XP_SESSION_BASE | 50 |
| XP_PER_MINUTE_AFTER_5 | 6 (minutos 6 a 10, máx 30) |
| XP_DOUBLE_DAY_BONUS | 25 (segunda sesión válida del día) |
| XP_BOSS_MULTIPLIER | 2 (sobre base y duración) |
| XP_CHALLENGE_BONUS | 15 (sesión abierta desde un desafío) |
| XP_STREAK_7_BONUS | 40 (al llegar a 7, 14, 21… días) |
| MAX_VALID_SESSIONS_PER_DAY | 3 (la cuarta no da XP) |
| GRACE_DAYS_PER_WEEK | 1 |
| LEADERBOARD_RESET | lunes 00:00 UTC |

Niveles de XP (RF-5.4), sin efecto funcional:

| Nombre | XP mínimo |
|---|---|
| Newcomer | 0 |
| Chatterbox | 500 |
| Storyteller | 1 500 |
| Debater | 3 500 |
| Native-ish | 7 000 |

## 2. Cálculo de XP en `close_session`

```
si duration_sec < MIN_SESSION_SEC o turns_count < 2 → xp = 0, no toca streak, fin.
sesiones_validas_hoy = sesiones ended del usuario con xp_earned > 0 en su "hoy" local.
si sesiones_validas_hoy >= MAX_VALID_SESSIONS_PER_DAY → xp = 0, sí cuenta para streak.
base = XP_SESSION_BASE
duracion = min(30, max(0, floor(duration_sec/60) - 5) * XP_PER_MINUTE_AFTER_5)
si kind = 'boss' → base y duracion se multiplican por XP_BOSS_MULTIPLIER
bonus_doble = XP_DOUBLE_DAY_BONUS si sesiones_validas_hoy == 1
bonus_desafio = XP_CHALLENGE_BONUS si session.challenge_from_user_id no es null
xp = base + duracion + bonus_doble + bonus_desafio
```

Cada componente inserta su fila en `xp_events`. Después:

```
hoy = fecha actual en profile.timezone
si last_session_day = hoy → nada
si last_session_day = ayer → streak += 1
si last_session_day = anteayer y grace_used_week = lunes_actual → streak += 1  (la gracia ya se aplicó en el job)
si no → streak = 1
last_session_day = hoy; longest_streak = max(...)
si streak % 7 == 0 → xp += XP_STREAK_7_BONUS (evento 'streak_7')
sessions_count += 1
```

Devuelve `{ xp_earned, streak, is_double_day, next_is_boss: (sessions_count + 1) % BOSS_EVERY_N_SESSIONS == 0 }`.

## 3. Streak individual y gracia (RF-5.2)

- La gracia se aplica en el job diario (SPEC-05 §6), no en el cierre, para que el usuario la vea al abrir la app ("Usaste tu día de gracia").
- Una gracia por semana calendario (lunes a domingo, en zona del usuario).
- En Home se muestra "Gracia disponible" o "Gracia usada esta semana".

## 4. Boss battle (RF-5.3)

- Se ofrece cuando `(sessions_count + 1) % 7 == 0`.
- `BOSS_TOPICS`: 40 temas fuera de la zona de confort, con tags opuestos a intereses típicos: economía, filosofía, ciencia, arte, política internacional, ética de la IA, historia, salud, arquitectura, etc.
- Se puede rechazar; se vuelve a ofrecer en la siguiente sesión. No se penaliza.

## 5. Leaderboard semanal (RF-6.1)

- RPC `weekly_leaderboard(group_id, week_start)`: `SUM(xp_events.amount)` por usuario entre `week_start` y `week_start + 7 días`, más `COUNT(sessions con xp_earned > 0)`.
- Empates: más sesiones primero, luego menor `user_id`.
- Semana ISO, lunes 00:00 UTC. La app muestra "faltan 2 días".

## 6. Streak grupal (RF-6.2)

Calculado en `daily-streaks`. Miembro "activo" = onboarded y con al menos una sesión válida en los últimos 14 días; así un amigo que dejó de usar la app no bloquea al grupo. Se muestra en Grupo y en el resumen semanal.

## 7. Desafíos cruzados (RF-6.4)

Sin LLM. `GET /challenges` devuelve, para cada miembro del grupo distinto del usuario, su sesión válida más reciente de los últimos 7 días cuyo `topic` el usuario no haya practicado en 14 días. Máximo 3. Al aceptar, la app abre `POST /sessions` con `kind` y `topic` iguales y `challengeFromUserId`; el cierre aplica `XP_CHALLENGE_BONUS`. Un desafío por miembro por semana. El servidor valida el desafío al abrir la sesión: `challengeFromUserId` solo se acepta si ese usuario aparece en la lista que `GET /challenges` devolvería en ese momento y con el mismo `topic`; si no, `422 CHALLENGE_NOT_AVAILABLE` (sin esa comprobación el bono sería auto-otorgable). **No** se exige que el `kind` coincida: la respuesta de `GET /challenges` no lleva `roleplayId` ni `newsItemId`, así que la app reabre todo desafío como `free_topic` con el `topic` legible, y para `boss` el servidor elige el tema por su cuenta.

## 8. Resumen semanal (RF-6.3)

Generado por el job (SPEC-05 §4) con la credencial del owner. La app lo muestra en Grupo el lunes y permite compartirlo. Si no está listo, "Se está cocinando" y reintento al volver.

## 9. Visibilidad (RF-6.5)

Los miembros ven de otros: nombre, nivel, XP, streak, último día con sesión y temas de sesiones (solo `topic` y `kind`, vía `/challenges`). Nunca turnos, correcciones, hechos ni briefs. Aplicado por RLS (SPEC-01 §3) y por los DTOs de la API, que no exponen esos campos en rutas de grupo.
