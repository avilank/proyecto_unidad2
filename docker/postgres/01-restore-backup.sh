#!/bin/bash
# Solo corre en el PRIMER arranque (BD vacía). Ver docker-entrypoint-initdb.d.
set -euo pipefail

BACKUP="/seed/backup2"

if [ ! -f "$BACKUP" ]; then
  echo "[postgres-init] No hay $BACKUP — se omite restore (se usará BD vacía + seed de la API)."
  exit 0
fi

echo "[postgres-init] Restaurando $BACKUP en $POSTGRES_DB…"

pg_restore \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --no-owner \
  --role="$POSTGRES_USER" \
  "$BACKUP"

echo "[postgres-init] Restore completado."
