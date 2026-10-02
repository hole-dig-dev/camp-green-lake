#!/bin/bash
# The grab / carry suite (JT 2026-09-30: carrying should feel natural). 29 checks, real keys, two browsers, ~3 min.
#   bash tests/carry/run.sh [port] [screenshot-dir] [script: suite.cjs | crew-hazards.cjs (the D Tent crew vs the weather and the animals) | crew-store.cjs | crew-panel.cjs | start-with-nothing.cjs | hire-crew.cjs | backsack.cjs | hopper.cjs | mines.cjs | pipeline.cjs | hazards.cjs | wardrobe.cjs | wallet-spend.cjs | pipeline-late.cjs | dynamite.cjs | disarm-dog.cjs]
# A fresh server on a scratch data dir with the event director off (no tumbleweeds carrying the test camper away).
cd "$(dirname "$0")/../.." || exit 1
P=${1:-4450};OUT=${2:-tests/out};D=$(mktemp -d);echo '{"director":{"on":false}}' > $D/world.json;echo '{"haz.mines":{"v":0,"def":1}}' > $D/tune.json;   # no landmines going off under the carry tests (mines.cjs turns them on)
mkdir -p "$OUT"
PORT=$P DEV_MODE=1 DATA_DIR=$D node server.js > $D/server.log 2>&1 & SV=$!;sleep 2
node tests/carry/${3:-suite.cjs} $P "$OUT";R=$?;kill $SV 2>/dev/null;exit $R
