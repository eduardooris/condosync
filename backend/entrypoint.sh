#!/bin/sh
# ───────────────────────────────────────────────────────────────────────────
# Entrypoint do container da API.
#
# Responsabilidades:
#   1. Rodar migrações TypeORM pendentes (`migration:run`) antes de subir.
#      Pode ser desabilitado em emergências com SKIP_MIGRATIONS=1.
#   2. Repassar o comando final (CMD: `node dist/main.js`) via `exec`,
#      garantindo que o processo Node receba SIGTERM diretamente do tini.
# ───────────────────────────────────────────────────────────────────────────
set -e

if [ "${SKIP_MIGRATIONS:-0}" = "1" ]; then
  echo "[entrypoint] SKIP_MIGRATIONS=1 — pulando migrations."
else
  echo "[entrypoint] Aplicando migrações TypeORM..."
  # Compilamos as migrations no build, então usamos o datasource compilado.
  node ./node_modules/typeorm/cli.js migration:run -d ./dist/database/data-source.js
fi

echo "[entrypoint] Iniciando aplicação..."
exec "$@"
