#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
map="$root/.claude/skills/verify-leadership-continuity/features/README.md"
features="$root/.claude/skills/verify-leadership-continuity/features"

[[ -r "$map" ]] || { echo "feature map missing: $map" >&2; exit 2; }
shopt -s nullglob
files=("$features"/*.md)
[[ ${#files[@]} -gt 1 ]] || { echo "no feature files" >&2; exit 2; }

for file in "${files[@]}"; do
  [[ "$file" == "$map" ]] && continue
  [[ "$file" == *"multi-surface-journeys.md" ]] && continue
  for heading in '## Sub-features' '## How to get to it (user POV)' '## Driving it with `control-app`' '## Gotchas'; do
    grep -Fqx -- "$heading" "$file" || { echo "missing heading '$heading' in $file" >&2; exit 1; }
  done
done

routes="$(find "$root/src/app" -type f -name page.tsx | sed -E 's#^.*/src/app##; s#/page\.tsx##; s#^$#/#' | sort)"
[[ -n "$routes" ]] || { echo "no routes found" >&2; exit 2; }

driven_routes="$({
  awk '
    {
      for (i = 1; i < NF; i++) {
        if ($i == "goto" && $(i + 1) ~ /^\//) print $(i + 1)
      }
    }
  ' "$features"/*.md
} | sort -u)"

unmapped_routes="$(awk '
  /^## Unmapped routes$/ { in_unmapped = 1; next }
  in_unmapped && /^## / { in_unmapped = 0 }
  in_unmapped && /^\| `\// {
    route = $2
    gsub(/`/, "", route)
    print route
  }
' "$map" | sort)"

duplicates="$(printf '%s\n' "$unmapped_routes" | sed '/^$/d' | uniq -d)"
[[ -z "$duplicates" ]] || { echo "duplicate unmapped route: $duplicates" >&2; exit 1; }

while IFS= read -r route; do
  if ! grep -Fxq -- "$route" <<< "$driven_routes" && ! grep -Fxq -- "$route" <<< "$unmapped_routes"; then
    echo "unmapped route: $route" >&2
    exit 1
  fi
done <<< "$routes"

while IFS= read -r route; do
  [[ -n "$route" ]] || continue
  grep -Fxq -- "$route" <<< "$routes" || { echo "stale unmapped route: $route" >&2; exit 1; }
  if grep -Fxq -- "$route" <<< "$driven_routes"; then
    echo "route is both mapped and unmapped: $route" >&2
    exit 1
  fi
done <<< "$unmapped_routes"

while IFS= read -r route; do
  [[ -n "$route" ]] || continue
  grep -Fxq -- "$route" <<< "$routes" || { echo "mapped route no longer exists: $route" >&2; exit 1; }
done <<< "$driven_routes"

echo "feature map is consistent"
