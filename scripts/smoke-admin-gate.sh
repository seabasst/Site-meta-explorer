#!/usr/bin/env bash
# Unauthenticated calls to the admin-only brand endpoints must get 401.
# Payloads can't change data even if the gate goes missing (unknown pageId,
# empty bodies). Usage: BASE=http://localhost:3000 scripts/smoke-admin-gate.sh
set -u
BASE="${BASE:-http://localhost:3000}"
fail=0
check() {
  code=$(curl -s -o /dev/null -w '%{http_code}' -X "$1" -H 'Content-Type: application/json' -d "$3" "$BASE$2")
  if [ "$code" = 401 ]; then echo "ok   $1 $2"; else echo "FAIL $1 $2 -> $code"; fail=1; fi
}
check POST   /api/ad-library/brands '{}'
check PATCH  /api/ad-library/brands '{"ids":[],"updates":{}}'
check PATCH  /api/ad-library/brands/smoke-nonexistent '{}'
check DELETE /api/ad-library/brands/smoke-nonexistent ''
exit $fail
