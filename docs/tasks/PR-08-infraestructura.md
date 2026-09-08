# PR-08 — Infraestructura · rama `feat/infra` · SPEC-08

Sesión líder: Sonnet 5. Empieza ya. Es el primer PR que se fusiona.

## T1 · Configuración base del monorepo y de la API
- Modelo: Sonnet 5 · Depende de: nada · Bloquea a: PR-02, PR-03, PR-04, PR-05, PR-07
- Alcance: `apps/api/src/config/product.ts` con todas las constantes de SPEC-04 §1 y SPEC-07 §1 exportadas y tipadas; `apps/api/src/config/env.ts` con validación de variables (zod) según SPEC-08 §2; `apps/api/.env.example`; `apps/api/src/main.ts` con `ValidationPipe` global, prefijo `/v1`, `pino` (`nestjs-pino`); `GET /v1/health` que responde `{ok, version}` (Redis e InsForge se añaden en T3).
- Aceptación: `pnpm --filter @fluent/api build && pnpm --filter @fluent/api test` en verde; `curl /v1/health` en un test e2e devuelve 200.
- Commit: `feat(api): configuración base, constantes de producto y health`

## T2 · Proyecto en InsForge Cloud
- Modelo: Haiku 4.5 · Depende de: nada (el operador ya creó el proyecto `fluent`, id `cca888af-daa6-4046-9828-f987e975dad1`, y `apps/api` ya está enlazado) · Bloquea a: PR-01
- Alcance: aplicar `config` de SPEC-08 §6 paso 2 con la CLI; verificar que `.insforge/project.json` está commiteado sin secretos; documentar la URL del proyecto en SPEC-08.
- Aceptación: `npx @insforge/cli current` muestra `fluent`; `npx @insforge/cli metadata --json` devuelve `requireEmailVerification: false`.
- Commit: `chore(infra): proyecto fluent en InsForge Cloud`

## T3 · Módulos de Redis e InsForge en la API
- Modelo: Sonnet 5 · Depende de: T1, T2 · Bloquea a: PR-02
- Alcance: `RedisModule` (ioredis, dos conexiones: colas y caché); `InsforgeModule` que expone `createAdminClient` configurado y un `InsforgeHttp` con `fetch` tipado para `/api/auth/sessions/current` y `/api/health`; `/v1/health` amplía a `{ok, version, redis, insforge}`.
- Aceptación: test unitario con Redis simulado (`ioredis-mock`) y `fetch` simulado; build en verde.
- Commit: `feat(api): módulos de Redis e InsForge con health completo`

## T4 · Dockerfile y arranque de worker
- Modelo: Sonnet 5 · Depende de: T1 · Bloquea a: despliegue
- Alcance: `apps/api/Dockerfile` multi-stage según SPEC-08 §3; `apps/api/src/worker.ts` que arranca solo el `WorkerModule` (vacío por ahora, lo llena PR-05); scripts `start:api` y `start:worker` en `package.json`; `.dockerignore`.
- Aceptación: `docker build -f apps/api/Dockerfile apps/api` termina y `docker run --rm <img> node -e "require('./dist/main.js')"` no falla en import (el arranque real requiere variables).
- Commit: `build(api): Dockerfile multi-stage y entrada del worker`

## T5 · CI en GitHub Actions
- Modelo: Haiku 4.5 · Depende de: T1 · Bloquea a: nada
- Alcance: `.github/workflows/ci.yml` con dos jobs: `api` (pnpm lint, test, build, `pnpm audit --audit-level high`) y `mobile` (flutter analyze, flutter test) en `ubuntu-latest`, cache de pnpm y de Flutter.
- Aceptación: el workflow pasa en el PR.
- Commit: `ci: lint, test y build de api y mobile en PR`

## T6 · Recursos en Coolify
- Modelo: Sonnet 5 · Depende de: T3, T4 y repo en GitHub · Bloquea a: pruebas desde el móvil
- Alcance: crear en Coolify el proyecto `fluent`, el recurso Redis `fluent-redis`, las aplicaciones `fluent-api` y `fluent-worker` según SPEC-08 §4, con variables de SPEC-08 §2 (valores reales solo en Coolify). Documentar en `docs/runbooks/despliegue.md` cómo redeployar y ver logs. Si la API de Coolify no está disponible para el agente, dejar el runbook con los pasos exactos para que el operador lo haga en la UI.
- Aceptación: `curl https://fluent-api.<ip>.sslip.io/v1/health` devuelve `ok: true`.
- Commit: `docs(runbook): despliegue en Coolify y checklist de variables`

## T7 · Runbook de InsForge y backups
- Modelo: Haiku 4.5 · Depende de: T2 · Bloquea a: nada
- Alcance: `docs/runbooks/insforge.md`: cómo aplicar migraciones, crear y fusionar ramas de InsForge, sacar backups semanales (cron en el VPS con `backups create`), rotar `CREDENTIALS_MASTER_KEY`.
- Aceptación: revisión de la sesión líder.
- Commit: `docs(runbook): operación de InsForge y backups`
