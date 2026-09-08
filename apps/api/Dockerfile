# Dockerfile de la API y el worker de Fluent (SPEC-08 §3/§4).
#
# Multi-stage: node:24-alpine -> pnpm install -> pnpm build -> imagen final
# con dist/ y node_modules de producción, usuario no root, HEALTHCHECK a
# /v1/health.
#
# Build de Coolify (SPEC-08 §4): build pack Dockerfile con CONTEXTO
# `apps/api` (no la raíz del monorepo), es decir:
#
#   docker build -f apps/api/Dockerfile apps/api
#
# Dentro de ese contexto no hay acceso al `pnpm-lock.yaml` ni al
# `pnpm-workspace.yaml` de la raíz del monorepo (viven un nivel por
# encima, fuera del contexto). Decisión documentada en
# docs/specs/PENDIENTES.md (2026-09-08, T4, PR-08): en vez de mover o
# duplicar el lockfile real del repo, se instala con
# `pnpm install --no-frozen-lockfile` dentro de este contexto acotado
# (apps/api es el único paquete del workspace, sin dependencias
# `workspace:` a otros paquetes, así que resolver un lockfile local aquí
# es equivalente en la práctica). La versión de pnpm sí queda fijada
# (`corepack prepare pnpm@<versión>`, igual que el campo `packageManager`
# de la raíz del monorepo) para que al menos el propio gestor de paquetes
# sea reproducible.
#
# La misma imagen sirve para la API y el worker (SPEC-08 §1): el comando
# por defecto (CMD) es el de la API; Coolify arranca `fluent-worker`
# sobrescribiendo el comando a `node dist/worker.js`.

ARG PNPM_VERSION=9.15.2

# ---------------------------------------------------------------------------
# Etapa "build": instala TODAS las dependencias (incluidas las de
# desarrollo, necesarias para `nest build`) y compila TypeScript -> dist/.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS build
ARG PNPM_VERSION
WORKDIR /app

RUN corepack enable && corepack prepare "pnpm@${PNPM_VERSION}" --activate

COPY package.json ./
RUN pnpm install --no-frozen-lockfile

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN pnpm build

# ---------------------------------------------------------------------------
# Etapa "prod-deps": instala solo las dependencias de producción, en una
# capa aparte para no arrastrar devDependencies a la imagen final.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS prod-deps
ARG PNPM_VERSION
WORKDIR /app

RUN corepack enable && corepack prepare "pnpm@${PNPM_VERSION}" --activate

COPY package.json ./
RUN pnpm install --no-frozen-lockfile --prod

# ---------------------------------------------------------------------------
# Etapa final: imagen de runtime mínima, sin pnpm ni herramientas de build.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# `package.json` hace falta en runtime: `src/config/version.ts` lo lee con
# `createRequire` para exponer `APP_VERSION` en /v1/health.
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

RUN chown -R node:node /app
USER node

# Imagen oficial `node:24-alpine`: no trae `curl`, pero sí `wget`
# (busybox) en la imagen base. Se usa `wget --spider` en vez de instalar
# `curl` para no añadir paquetes a la imagen final.
#
# El límite de memoria (1 GB API / 768 MB worker) se configura en Coolify
# (T6), no aquí.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider "http://localhost:${PORT:-3000}/v1/health" || exit 1

# Comando por defecto: la API. El worker sobrescribe este comando en
# Coolify con `node dist/worker.js` (SPEC-08 §1).
CMD ["node", "dist/main.js"]
