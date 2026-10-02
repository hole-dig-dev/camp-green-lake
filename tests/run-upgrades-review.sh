#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
PORT=${1:-4318}
REVIEW_DATA=$(mktemp -d "$PWD/.upgrade-review.XXXXXX")
echo '{"director":{"on":false}}' > "$REVIEW_DATA/world.json"
PORT="$PORT" DEV_MODE=1 DATA_DIR="$REVIEW_DATA" node server.js > "$REVIEW_DATA/server.log" 2>&1 & REVIEW_PID=$!
trap 'kill "$REVIEW_PID" 2>/dev/null || true; wait "$REVIEW_PID" 2>/dev/null || true; rm -rf "$REVIEW_DATA"' EXIT
sleep 2
if ! kill -0 "$REVIEW_PID" 2>/dev/null; then cat "$REVIEW_DATA/server.log"; exit 1; fi
node /home/botuser/personal-assistant/scripts/gpu-preflight.mjs
node tests/upgrades-review.cjs "$PORT"
