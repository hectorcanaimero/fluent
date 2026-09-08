#!/usr/bin/env bash
# Envoltorio de `insforge db migrations ...`.
#
#   ./scripts/db-migrate.sh new sesiones-turnos-correcciones
#   ./scripts/db-migrate.sh up --all
#   ./scripts/db-migrate.sh list
#
# El CLI de InsForge valida el nombre de TODAS las entradas de `migrations/` y
# se para con "Invalid migration filename: tests" al ver el directorio
# `migrations/tests/`, donde SPEC-01 y PR-01 piden que vivan los tests SQL.
# Este envoltorio lo aparta mientras corre el comando y lo devuelve después.
set -euo pipefail

cd "$(dirname "$0")/.."

TESTS_DIR="migrations/tests"
STASH_DIR=""

restore() {
  if [ -n "$STASH_DIR" ] && [ -d "$STASH_DIR/tests" ]; then
    mv "$STASH_DIR/tests" "$TESTS_DIR"
    rmdir "$STASH_DIR"
  fi
}

if [ -d "$TESTS_DIR" ]; then
  STASH_DIR="$(mktemp -d)"
  trap restore EXIT
  mv "$TESTS_DIR" "$STASH_DIR/tests"
fi

npx -y @insforge/cli db migrations "$@"
