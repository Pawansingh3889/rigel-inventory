#!/usr/bin/env bash
# Replay supabase/migrations onto a throwaway Postgres container and report failures.
# Proves whether the migration history can still rebuild the database from nothing.
#
#   ./scripts/replay-migrations.sh
#
# Leaves the container running so the rebuilt schema can be inspected:
#   podman exec -it rigel-drift-pg psql -U postgres -d rigel
set -euo pipefail

CONTAINER=rigel-drift-pg
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME=$(command -v podman || command -v docker)

"$RUNTIME" rm -f "$CONTAINER" >/dev/null 2>&1 || true
"$RUNTIME" run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=devlocal -e POSTGRES_DB=rigel \
  -p 55432:5432 postgres:16 >/dev/null

until "$RUNTIME" exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

"$RUNTIME" exec -i "$CONTAINER" psql -U postgres -d rigel -v ON_ERROR_STOP=1 -q \
  < "$REPO/scripts/supabase-shim.sql"

ok=0; fail=0
for f in "$REPO"/supabase/migrations/*.sql; do
  if err=$("$RUNTIME" exec -i "$CONTAINER" psql -U postgres -d rigel -v ON_ERROR_STOP=1 -q < "$f" 2>&1 >/dev/null); then
    ok=$((ok + 1))
  else
    fail=$((fail + 1))
    echo "FAIL $(basename "$f")"
    echo "     $(echo "$err" | grep -m1 'ERROR:' | sed 's/^psql:[^:]*:[0-9]*: //')"
  fi
done

echo
echo "applied: $ok   failed: $fail   total: $((ok + fail))"
