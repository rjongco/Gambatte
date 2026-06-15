#!/usr/bin/env bash
# Load a data-only dump (from scripts/db-dump.sh) into a target database. Run this
# ONCE against staging AFTER the migrate service has created the schema, and while
# the tables are still empty (data-only inserts assume no conflicting rows).
#
#   STAGING_DATABASE_URL=postgres://user:pass@host:5432/gambatte \
#     bash scripts/db-restore.sh gambatte_data.sql
set -euo pipefail

IN="${1:-gambatte_data.sql}"
: "${STAGING_DATABASE_URL:?set STAGING_DATABASE_URL to the target connection string}"

if [ ! -f "$IN" ]; then
  echo "Dump file not found: $IN" >&2
  exit 1
fi

# Stop on the first error (e.g. a duplicate key) instead of partially loading.
psql "$STAGING_DATABASE_URL" --set ON_ERROR_STOP=1 -f "$IN"

echo "Restored $IN into the target database."
