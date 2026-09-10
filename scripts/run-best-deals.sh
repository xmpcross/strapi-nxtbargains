#!/usr/bin/env bash
#
# Cron wrapper for fetch-best-deals-zenrows.mjs, which fills /best-deals.
#
# Exists for the same reason run_daily_prices.sh does: cron supplies almost no
# environment. Node is not on the default PATH here (it lives under nvm), and
# the script resolves .env.local relative to its own directory, so it has to be
# started from the project root with an absolute interpreter.
set -uo pipefail

ROOT=/opt/projects/nxt.bargains
NODE=/root/.nvm/versions/node/v22.23.1/bin/node
LOG_DIR=/var/log/nxt-bargains
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/best-deals-$(date +%Y-%m).log"

cd "$ROOT" || exit 1

{
  echo "=== $(date -Is) starting best-deals refresh ==="
  # The script leaves the previous cache untouched and exits non-zero when it
  # parses nothing, so a retailer markup change degrades to stale data on the
  # page rather than an empty section.
  "$NODE" scripts/fetch-best-deals-zenrows.mjs
  status=$?
  echo "=== $(date -Is) finished, exit $status ==="
  echo
} >> "$LOG" 2>&1

# Costs 25 ZenRows credits per retailer per run (js_render + premium_proxy are
# both required), so four sources is 100 credits a day against a 45,000/month
# plan. Raising the frequency is what would make this expensive, not the count.
find "$LOG_DIR" -name 'best-deals-*.log' -mtime +95 -delete 2>/dev/null || true
