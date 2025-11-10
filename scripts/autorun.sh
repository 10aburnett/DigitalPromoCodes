#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# 0) env
if [[ -f ".env.prod" ]]; then
  # shellcheck disable=SC2046
  export $(grep -v '^\s*#' .env.prod | xargs)
fi

LOGDIR="$ROOT/logs"; mkdir -p "$LOGDIR"
ENV_FILE="/tmp/prod-cost-optimized-env.sh"
touch "$ENV_FILE"
printf 'export MODEL=%s\nexport ITEM_BUDGET_USD=%s\nexport OPENAI_API_KEY=%s\n' \
  "${MODEL:-gpt-4o-mini}" "${ITEM_BUDGET_USD:-0.20}" "${OPENAI_API_KEY:-}" > "$ENV_FILE"

echo "➡️  autorun: model=${MODEL:-gpt-4o-mini} batch=${BATCH_LIMIT:-200} $/batch=${BATCH_BUDGET_USD:-50}"

# 1) one-time cleanup
pkill -9 -f "run-all-whops|go-live|generate-whop-content" 2>/dev/null || true
mkdir -p data/locks && rm -f data/locks/*.lock /tmp/next-batch.csv || true

# optional sanity gate
if [[ "${SANITY_ONCE:-1}" == "1" ]]; then
  NOW="$(date -u +%Y%m%dT%H%M%S)"; LOG="$LOGDIR/prod.$NOW.log"
  export RUN_ID="${NOW}Z-$RANDOM"
  echo "🧪 sanity batch (limit=60, budget=15)" | tee -a "$LOG"
  node scripts/run-all-whops.mjs --scope=all --limit=60 --budgetUsd=15 2>&1 | tee -a "$LOG" || true
  node scripts/audit-invariants.mjs || bash scripts/emergency-restore.sh || true
  export SANITY_ONCE=0
fi

# helper: log+timestamp
ts() { date -u +%Y%m%dT%H%M%S; }

# main loop: runs forever
while :; do
  NOW="$(ts)"; LOG="$LOGDIR/prod.$NOW.log"
  export RUN_ID="${NOW}Z-$RANDOM"

  # A) house-keeping: compact + requeue transient fetch failures
  node scripts/consolidate-results.mjs || true
  if [[ -f scripts/requeue-transient-fetch-failures.mjs ]]; then
    node scripts/requeue-transient-fetch-failures.mjs || true
  fi
  node scripts/sync-checkpoint-from-master.mjs || true
  node scripts/audit-invariants.mjs || true

  # B) run one autonomous batch (controller handles consolidate→sync→audit + self-heal)
  echo "▶️  starting batch: limit=${BATCH_LIMIT:-200} budget=${BATCH_BUDGET_USD:-50} (RUN_ID=$RUN_ID)" | tee -a "$LOG"
  # write env file each cycle (in case .env.prod changed)
  printf 'export MODEL=%s\nexport ITEM_BUDGET_USD=%s\nexport OPENAI_API_KEY=%s\n' \
    "${MODEL:-gpt-4o-mini}" "${ITEM_BUDGET_USD:-0.20}" "${OPENAI_API_KEY:-}" > "$ENV_FILE"

  # call the runner; it will handle locks & emergency-restore on its own
  set +e
  node scripts/run-all-whops.mjs --scope=all --limit="${BATCH_LIMIT:-200}" --budgetUsd="${BATCH_BUDGET_USD:-50}" 2>&1 | tee -a "$LOG"
  CODE="${PIPESTATUS[0]}"
  set -e

  # C) after-batch audit; if bad, emergency-restore
  if ! node scripts/audit-invariants.mjs >/dev/null 2>&1; then
    echo "🩹 audit failed → running emergency-restore" | tee -a "$LOG"
    bash scripts/emergency-restore.sh | tee -a "$LOG" || true
  fi

  # D) check if anything remains; if empty, still daemonize (keeps polling)
  # (We rely on query-whops-needing-content.mjs for the single source of truth.)
  REMAIN="$(node -e "process.stdout.write(String(require('child_process').execSync('node scripts/query-whops-needing-content.mjs | wc -l').toString().trim()))")" || REMAIN="0"
  echo "ℹ️  remaining-from-DB=${REMAIN}" | tee -a "$LOG"

  # E) short sleep between cycles
  sleep "${SLEEP_SECONDS:-20}"
done
