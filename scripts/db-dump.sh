#!/usr/bin/env bash
# Dump ONLY the row data from the local gambatte Postgres (schema is owned by the
# Drizzle migrations, which staging runs on its own). Produces a portable,
# inspectable INSERT script. The output file is NOT committed (see .gitignore).
#
#   bash scripts/db-dump.sh                 # -> gambatte_data.sql
#   bash scripts/db-dump.sh my-backup.sql   # custom path
set -euo pipefail

OUT="${1:-gambatte_data.sql}"
CONTAINER="${DB_CONTAINER:-gambatte_db}"

docker exec "$CONTAINER" pg_dump -U gambatte -d gambatte \
  --data-only --column-inserts --no-owner --no-privileges \
  > "$OUT"

echo "Wrote $(wc -l < "$OUT") lines to $OUT"
