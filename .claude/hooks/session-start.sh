#!/usr/bin/env bash
# SessionStart hook: make sure dependencies are installed so typecheck/test work right away
# (fresh cloud sessions start without node_modules). Prints one short line into the session.
set -euo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}"

if [ ! -d node_modules ] || [ pnpm-lock.yaml -nt node_modules/.modules.yaml ]; then
  if pnpm install --frozen-lockfile >/dev/null 2>&1; then
    echo "Dependencies installed (pnpm install)."
  else
    echo "pnpm install failed – run it manually before typecheck/test."
  fi
fi

# A preinstalled Chromium (cloud sessions) lets `pnpm e2e` run without downloading browsers.
for p in /opt/pw-browsers/chromium-*/chrome-linux/chrome; do
  if [ -x "$p" ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo "export PW_CHROMIUM_PATH=$p" >> "$CLAUDE_ENV_FILE"
  fi
  break
done
exit 0
