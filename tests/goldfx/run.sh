#!/bin/bash
# run.sh <port> <script> [args...]: own fresh server, event director off.
set -u
cd "$(dirname "$0")/../.." || exit 1
P=$1; shift
D=$(mktemp -d); echo '{"director":{"on":false}}' > "$D/world.json"
PORT=$P DEV_MODE=1 DATA_DIR=$D node server.js > "$D/server.log" 2>&1 & SV=$!
trap 'kill "$SV" 2>/dev/null; wait "$SV" 2>/dev/null; rm -rf "$D"' EXIT
sleep 2
if ! kill -0 "$SV" 2>/dev/null; then cat "$D/server.log"; exit 1; fi
timeout 600 node "$@"
