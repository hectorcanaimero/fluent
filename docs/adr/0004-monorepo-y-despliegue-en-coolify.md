# ADR 0004 — Monorepo pnpm y despliegue en Coolify sobre el VPS

Fecha: 2026-09-08 · Estado: Aceptado

## Contexto
El VPS (Contabo, 8 vCPU, 23 GB) ya corre Coolify con Traefik y otros proyectos NestJS. No hay dominio propio configurado; Coolify usa subdominios `sslip.io` sobre la IP pública con certificados de Let's Encrypt.

## Decisión
- Un solo repositorio `fluent` con:
  - `apps/api` — NestJS (API y worker, mismo código, distinto comando de arranque).
  - `apps/mobile` — Flutter.
  - `.insforge/` — enlace al proyecto de InsForge Cloud (generado por la CLI, sin secretos en git).
  - `docs/` — PRD, ADRs, diagramas.
- `pnpm` con workspace para la parte Node. Flutter usa su propio tooling.
- Despliegue con Coolify: API y worker como aplicaciones desde el repo, Redis como recurso de Coolify. InsForge corre en InsForge Cloud (ADR 0001).
- Dominio de desarrollo: `fluent-api.<ip>.sslip.io`. Se cambia a dominio propio cuando exista, sin tocar código (solo variables de entorno).

## Alternativas consideradas
- **Repos separados por app.** Descartado: el proyecto es de una persona y los contratos entre API y móvil cambian a la vez.
- **Docker Compose a mano fuera de Coolify.** Descartado: Coolify ya da Traefik, certificados, logs y redeploy desde git.

## Consecuencias
- Un `pnpm install` en la raíz prepara la API. Flutter se instala aparte.
- Los secretos viven en Coolify, nunca en el repo. `.env.example` documenta cada variable.
- Las builds de la API se hacen en el VPS; la ruta a GitHub es inestable a ratos, así que Coolify debe clonar con reintentos.
