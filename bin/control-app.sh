#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${APP_URL:-http://localhost:3000}"
EVIDENCE_DIR="${VERIFY_EVIDENCE_DIR:-artifacts/verification}"

usage() {
  cat <<'EOF'
Usage: bin/control-app.sh <command> [args]

Commands:
  doctor                 Verify a non-production local app is reachable
  goto <route>           Fetch an allowlisted local route into evidence
  dump [path]            Save the route HTML/UI source as evidence
  screenshot [path]      Save HTML evidence (use browser capture for pixels)
  cleanup                Remove this run's scratch files only
EOF
}

die() { echo "control-app: $*" >&2; exit 2; }

ensure_local() {
  case "$BASE_URL" in
    http://localhost:*|http://127.0.0.1:*) ;;
    *) die "refusing non-local URL: $BASE_URL" ;;
  esac
}

validate_route() {
  local route="${1:-}"
  [[ "$route" == /* ]] || die "route must start with /"
  [[ "$route" != *$'\n'* && "$route" != *$'\r'* ]] || die "route must be one line"
  case "$route" in
    *' '*|*$'\t'*|*';'*|*'|'*|*'<'*|*'>'*|*'\$('*|*'`'*) die "route contains unsupported characters" ;;
  esac
}

fetch_route() {
  local route="$1" out="$2"
  validate_route "$route"
  mkdir -p "$EVIDENCE_DIR"
  curl --fail --silent --show-error --location --max-time 15 \
    --write-out '\n<!-- control-app: HTTP %{http_code} -->\n' \
    "$BASE_URL$route" > "$out"
}

doctor() {
  ensure_local
  local body
  body="$(mktemp)"
  trap 'rm -f "$body"' RETURN
  if ! curl --fail --silent --show-error --max-time 5 "$BASE_URL/" > "$body"; then
    echo '{"ok":false,"reason":"local app is unreachable"}'
    exit 1
  fi
  if ! rg -q 'Leader Continuity|Leadership Continuity' "$body"; then
    echo '{"ok":false,"reason":"reachable app did not contain the expected build marker"}'
    exit 1
  fi
  printf '{"ok":true,"baseUrl":"%s"}\n' "$BASE_URL"
}

case "${1:-}" in
  doctor) doctor ;;
  goto|dump|screenshot)
    ensure_local
    route="${2:-/}"
    out="${3:-$EVIDENCE_DIR/$(date +%Y%m%d-%H%M%S)-route.html}"
    fetch_route "$route" "$out"
    printf '{"ok":true,"route":"%s","evidence":"%s"}\n' "$route" "$out"
    ;;
  cleanup)
    rm -rf "$EVIDENCE_DIR/scratch"
    echo '{"ok":true,"removed":"scratch"}'
    ;;
  -h|--help|"") usage ;;
  *) usage >&2; exit 2 ;;
esac
