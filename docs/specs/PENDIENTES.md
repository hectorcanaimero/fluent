# Pendientes y decisiones sin spec

- 2026-09-08 (T1, PR-08): `LEADERBOARD_RESET` (SPEC-07 §1) se tipa como el
  literal de string `'monday_00_utc'` (`as const`, con un tipo
  `LeaderboardReset` derivado) en vez de un enum. Es el tipo más simple para
  un único valor posible hoy; si en el futuro hay varios momentos de reset
  configurables, se puede migrar a `z.enum(...)` o a un enum de TypeScript
  sin romper el uso actual. Ver `apps/api/src/config/product.ts`.

- 2026-09-08 (T1, PR-08): Opciones de `ValidationPipe` global en
  `apps/api/src/main.ts` no están especificadas en ninguna spec. Se eligieron
  `{ whitelist: true, forbidNonWhitelisted: true, transform: true }` por ser
  el valor por defecto razonable y más simple para DTOs futuros (rechaza
  propiedades no declaradas y castea tipos primitivos automáticamente).
  Revisar si algún endpoint concreto necesita desviarse de esto.

- 2026-09-08 (T1, PR-08): Estrategia de `.env.test` para que
  `ConfigModule`/`AppModule` arranquen en tests sin secretos reales: se creó
  `apps/api/.env.test` (commiteado, con valores ficticios) y
  `envFilePath` en `ConfigModule.forRoot(...)` se elige según
  `process.env.NODE_ENV === 'test'` (vitest lo define automáticamente,
  verificado con una prueba puntual) → `.env.test`, si no → `.env`. Es la
  opción más simple que no requiere mocks de `ConfigService` en cada test.
  Se confirmó que `apps/api/.env.test` no cae bajo ningún patrón de
  `.gitignore` (ni el de la raíz ni el de `apps/api/.gitignore`), con
  `git check-ignore -v apps/api/.env.test` (sin salida → no ignorado).
