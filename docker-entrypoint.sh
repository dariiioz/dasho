#!/bin/sh
set -eu

echo "[dasho] Application des migrations SQLite..."
./node_modules/.bin/drizzle-kit migrate --config=drizzle.config.ts

echo "[dasho] Démarrage du serveur sur le port ${PORT:-3000}."
exec node server.js
