# SPEC-08 — Infraestructura y despliegue

Estado: borrador v0.1 · Cubre: RNF de costo, disponibilidad, seguridad, portabilidad, observabilidad · ADR 0001, 0004

## 1. Piezas

| Pieza | Dónde | Cómo |
|---|---|---|
| InsForge (auth, Postgres, storage) | InsForge Cloud, región `us-east` (misma que los proyectos existentes de la cuenta) | proyecto `fluent`, enlazado con `.insforge/project.json` |
| API NestJS | VPS, Coolify | aplicación desde el repo, Dockerfile en `apps/api`, comando `node dist/main.js` |
| Worker | VPS, Coolify | misma imagen, comando `node dist/worker.js` |
| Redis | VPS, Coolify | recurso Redis 7, sin exposición pública |
| App móvil | dispositivos | builds locales en la Mac del operador; distribución por APK directo e TestFlight interno |

Dominio de desarrollo: `fluent-api.13.140.175.146.sslip.io` con certificado de Let's Encrypt gestionado por Traefik. Al tener dominio propio, se cambia en Coolify y en la variable `API_URL` de la app.

## 2. Variables de entorno de la API y el worker

| Variable | Ejemplo | Notas |
|---|---|---|
| NODE_ENV | production | |
| PORT | 3000 | |
| INSFORGE_URL | https://xxxx.us-east.insforge.app | |
| INSFORGE_API_KEY | ik_… | admin; solo backend |
| INSFORGE_ANON_KEY | anon_… | para llamadas con token de usuario si hicieran falta |
| REDIS_URL | redis://fluent-redis:6379 | red interna de Coolify |
| CREDENTIALS_MASTER_KEY | base64 de 32 bytes | SPEC-02 §5 |
| CREDENTIALS_MASTER_KEY_PREVIOUS | | solo durante rotación |
| OPENROUTER_OAUTH_CALLBACK | fluent://oauth/openrouter | |
| FALLBACK_MODELS | JSON | SPEC-03 §2 |
| PROMPT_VERSION | 1 | |
| OWNER_USER_ID | uuid | quién es el operador |
| LOG_LEVEL | info | |

Secretos solo en Coolify. `apps/api/.env.example` lista todas con comentario y sin valores.

## 3. Dockerfile de la API

Multi-stage: `node:24-alpine` → `pnpm install --frozen-lockfile` → `pnpm build` → imagen final con `dist/` y `node_modules` de producción, usuario no root, `HEALTHCHECK` a `/v1/health`. Límite de memoria en Coolify: 1 GB para la API, 768 MB para el worker.

## 4. Coolify

- Proyecto `fluent`, entorno `production`.
- Recurso Redis `fluent-redis`.
- Aplicación `fluent-api`: fuente GitHub (repo privado del operador), rama `main`, build pack Dockerfile con contexto `apps/api`, puerto 3000, dominio sslip.io, healthcheck.
- Aplicación `fluent-worker`: misma fuente, comando de arranque sobrescrito, sin dominio.
- Auto-deploy por webhook de GitHub en push a `main`.
- Como la ruta del VPS a GitHub falla a ratos, Coolify reintenta el clone; si un deploy falla en clone, se relanza a mano. El build no depende de GitHub una vez clonado.

## 5. Repositorio y CI

- GitHub, repo privado `fluent`. Ramas: `main` desplegable; ramas de feature con PR.
- GitHub Actions en PR: `pnpm lint`, `pnpm test`, `pnpm build` para la API; `flutter analyze` y `flutter test` para la app. Sin deploy desde CI; despliega Coolify.
- Migraciones: se aplican a mano con la CLI de InsForge desde el VPS antes del deploy que las necesita, previa prueba en una rama de InsForge. Se documenta en el PR.

## 6. InsForge: configuración inicial

1. Proyecto ya creado; `npx @insforge/cli link --project-id cca888af-daa6-4046-9828-f987e975dad1` desde `apps/api`.
2. `config` : `requireEmailVerification=false` en v1, `disableSignup=false`, `allowedRedirectUrls` no aplica (auth por REST desde móvil).
3. Migraciones de SPEC-01 con `db migrations up --all`.
4. `secrets get ANON_KEY` y API key a las variables de Coolify.
5. Backups: `backups create` semanal desde un cron del VPS.

Estado 2026-09-08: proyecto `fluent` creado por el operador (id `cca888af-daa6-4046-9828-f987e975dad1`, appkey `c4jzbm8x`, región `us-east`), `test` eliminado. `apps/api` enlazado. URL del proyecto: `https://c4jzbm8x.us-east.insforge.app` (es el valor real de `INSFORGE_URL`). PR-08/T2: `config` aplicado con `npx @insforge/cli config export/plan/apply` (`apps/api/insforge.toml`, commiteado); `requireEmailVerification` quedó en `false`, `disableSignup` ya estaba en `false`.

## 7. Observabilidad

- Logs JSON con `pino` en API y worker; Coolify los muestra y rota.
- `GET /v1/health` comprueba Redis (`PING`) e InsForge (`GET /api/health`).
- Métricas de producto en `/v1/admin/metrics` (SPEC-02 §4.6).
- Alertas: el owner recibe un correo si `health` falla, vía el monitor de Coolify (Sentinel) apuntando al endpoint.

## 8. Seguridad

- API y worker sin acceso SSH; solo variables de entorno.
- Rate limiting en la API (SPEC-02 §7) y en Traefik 100 req/s por IP.
- CORS cerrado: la app móvil no lo necesita; solo se abre `/v1/docs` fuera de producción.
- Dependencias: `pnpm audit` en CI, fallo en severidad alta.
- El VPS ya tiene fail2ban, SSH solo con clave y earlyoom (sesión de 2026-09-08).

## 9. Entorno local del operador

- API: `pnpm --filter @fluent/api start:dev` contra el proyecto de InsForge y un Redis local en Docker (`docker run -p 6379:6379 redis:7-alpine`). En el VPS, arrancar con `devsrv -m 1G` según las reglas del servidor.
- App: `flutter run` en la Mac con `--dart-define=API_URL=... --dart-define=INSFORGE_URL=...`.
- Para probar la API desde el móvil físico contra el VPS, usar el dominio sslip.io o Tailscale.
