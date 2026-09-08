#!/usr/bin/env bash
# Ejecuta un test SQL de migrations/tests contra el proyecto InsForge enlazado.
#
#   ./scripts/run-sql-test.sh migrations/tests/rls_grupos.sql
#   ./scripts/run-sql-test.sh            # todos los tests, en orden
#
# Un test que falla lanza RAISE EXCEPTION y este script termina con código != 0.
set -euo pipefail

cd "$(dirname "$0")/.."

# npm imprime el comando entero como "notice" y ensucia la salida del test.
export NPM_CONFIG_LOGLEVEL=silent

run_one() {
  echo "── $1"
  # El "--" evita que commander lea el comentario inicial del .sql como opción.
  npx -y @insforge/cli db query -- "$(cat "$1")"
}

if [ "$#" -gt 0 ]; then
  for f in "$@"; do run_one "$f"; done
else
  for f in migrations/tests/*.sql; do run_one "$f"; done
fi

echo "Tests SQL en verde."
