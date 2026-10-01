#!/bin/bash
# The grab / carry suite (JT 2026-09-30: carrying should feel natural). 29 checks, real keys, two browsers, ~3 min.
#   bash tests/carry/run.sh [port] [screenshot-dir]
# A fresh server on a scratch data dir with the event director off (no tumbleweeds carrying the test camper away).
cd "$(dirname "$0")/../.." || exit 1
P=${1:-4450};OUT=${2:-tests/out};D=$(mktemp -d);echo '{"director":{"on":false}}' > $D/world.json;mkdir -p "$OUT"
PORT=$P DEV_MODE=1 DATA_DIR=$D node server.js > $D/server.log 2>&1 & SV=$!;sleep 2
node tests/carry/suite.cjs $P "$OUT";R=$?;kill $SV 2>/dev/null;exit $R
