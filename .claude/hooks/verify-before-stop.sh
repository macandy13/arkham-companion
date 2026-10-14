#!/usr/bin/env bash
# Stop hook: before Claude finishes a turn that changed code, run typecheck, lint and tests.
# On failure, exit 2 so the errors are fed back and Claude fixes them before stopping.
# Skips when nothing relevant changed, and never blocks twice in a row (stop_hook_active).
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}"

input=$(cat)
active=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).stop_hook_active===true))}catch{process.stdout.write("false")}})')
[ "$active" = "true" ] && exit 0

# Only check when source/config files differ from main (committed or not).
base=$(git merge-base HEAD origin/main 2>/dev/null || echo HEAD)
changed=$( { git diff --name-only "$base"; git diff --name-only; git ls-files --others --exclude-standard; } 2>/dev/null \
  | grep -E '\.(ts|tsx|js|mjs|cjs|json|ya?ml|css|html|md)$' | sort -u)
[ -z "$changed" ] && exit 0

[ -d node_modules ] || pnpm install --frozen-lockfile >/dev/null 2>&1

out=$( { pnpm typecheck && pnpm lint && pnpm test; } 2>&1 )
if [ $? -ne 0 ]; then
  {
    echo "Checks failed (pnpm typecheck && pnpm lint && pnpm test). Fix these before finishing:"
    echo "$out" | tail -n 60
    echo "(Formatting only? Run: pnpm format)"
  } >&2
  exit 2
fi
exit 0
