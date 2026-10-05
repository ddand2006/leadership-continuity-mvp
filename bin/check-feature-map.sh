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
    rg -Fqx "$heading" "$file" || { echo "missing heading '$heading' in $file" >&2; exit 1; }
  done
done

routes="$(find "$root/src/app" -type f -name page.tsx | sed -E 's#^.*/src/app##; s#/page\.tsx##; s#^$#/#' | sort)"
[[ -n "$routes" ]] || { echo "no routes found" >&2; exit 2; }
while IFS= read -r route; do
  if ! rg -Fq "control-app.sh goto $route" "$features"; then
    if ! rg -Fq "| \`$route\` |" "$map"; then
      echo "unmapped route: $route" >&2
      exit 1
    fi
  fi
done <<< "$routes"

echo "feature map is consistent"
