#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

BATCH_DIR="/tmp"
BATCH_GLOB="${BATCH_DIR}/retry-batch-*"
LOG_DIR="${ROOT_DIR}/data/logs/batch-runs"

mkdir -p "$LOG_DIR"

echo "Repo root: $ROOT_DIR"
echo "Log dir:   $LOG_DIR"
echo

shopt -s nullglob

batches=($BATCH_GLOB)

if [ ${#batches[@]} -eq 0 ]; then
  echo "No batch files found matching ${BATCH_GLOB}"
  exit 0
fi

IFS=$'\n' batches=($(printf '%s\n' "${batches[@]}" | sort))
unset IFS

for batch in "${batches[@]}"; do
  batch_basename="$(basename "$batch")"
  batch_name="${batch_basename%.txt}"
  done_marker="${LOG_DIR}/${batch_name}.done"
  log_file="${LOG_DIR}/${batch_name}.log"

  if [ -f "$done_marker" ]; then
    echo "⏭  Skipping ${batch_name} (already marked done)"
    continue
  fi

  echo
  echo "==============================="
  echo "▶  Running batch: ${batch_name}"
  echo "    Slug file: $batch"
  echo "    Log file : $log_file"
  echo "==============================="
  echo

  cd "$ROOT_DIR"

  RULESET=must-succeed \
  IGNORE_CHECKPOINT=1 \
  ALLOW_OVERWRITE=1 \
  ENABLE_JS_RENDER=0 \
  ENABLE_EXTRACTIVE=0 \
  FAQ_MAX_TRIES=1 \
  RELAX_FAQ_GROUNDING=1 \
  node scripts/generate-whop-content.mjs \
    --in=data/neon/whops.jsonl \
    --onlySlugsFile="$batch" \
    --concurrency=3 \
    --budgetUsd=10 \
    | tee "$log_file"

  echo
  echo "✅ Finished ${batch_name}"
  date -Iseconds > "$done_marker"
done

echo
echo "🎉 All available batches processed (or already done)."
