#!/usr/bin/env bash
#
# Deploy nxt.bargains.
#
# Production runs on THIS host now, from this very directory -- there is no
# copy step and no remote. The site was previously built on 178.105.206.112
# and reached over the public Strapi hostname; it now runs beside Strapi and
# reads it over the loopback (~34ms vs ~1.3s per request).
#
#   ./deploy.sh          build from the working tree, then restart
#   ./deploy.sh --pull   git pull first
#
# Because the working tree IS production, an uncommitted edit goes live the
# moment this runs. That is deliberate -- it is what makes previewing local
# changes cheap -- but it means a half-finished edit ships too, so the script
# refuses to build a dirty tree unless you pass --allow-dirty.

set -euo pipefail
cd "$(dirname "$0")"

PULL=0; ALLOW_DIRTY=0
for a in "$@"; do
  case "$a" in
    --pull) PULL=1 ;;
    --allow-dirty) ALLOW_DIRTY=1 ;;
    *) echo "unknown flag: $a" >&2; exit 2 ;;
  esac
done

export NVM_DIR=/root/.nvm
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use 22 >/dev/null
export NODE_OPTIONS=--max-old-space-size=2048

[ "$PULL" = 1 ] && git pull --ff-only

if [ -n "$(git status --porcelain)" ] && [ "$ALLOW_DIRTY" = 0 ]; then
  echo "working tree is dirty -- commit, stash, or pass --allow-dirty" >&2
  git status --short >&2
  exit 1
fi

# A successful build does NOT guarantee new HTML: .next/cache holds prerendered
# ISR pages and will happily keep serving the previous render. This cost a full
# debugging round on the search dialog -- the build was correct and the old
# markup was still served. Clearing it is a few seconds of rebuild.
rm -rf .next/cache

npm run build
sudo systemctl restart nxt-bargains.service

for _ in $(seq 1 20); do
  sleep 2
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 20 http://127.0.0.1:3008/ || true)
  [ "$code" = "200" ] && { echo "deployed: $(git log --oneline -1)"; exit 0; }
done

echo "site did not return 200 after restart -- check: journalctl -u nxt-bargains -n 50" >&2
exit 1
