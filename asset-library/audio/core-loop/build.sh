#!/usr/bin/env bash
# Rebuilds the core-loop cue clips (public/audio/*.mp3) from the CC0 originals in asset-library/audio/sources/core-loop/.
# Each clip: leading silence trimmed, mono 44.1 kHz, a 12 ms fade-out, peak-normalised to -3 dBFS, MP3 (LAME VBR q4).
# The in-game mix levels live in public/js/41-cues.js; every clip leaves here at the same peak so those numbers compare.
# Usage: bash asset-library/audio/core-loop/build.sh   (from the repo root; needs ffmpeg)
set -euo pipefail
SRC=asset-library/audio/sources/core-loop; OUT=public/audio
MAP="
coin-1=impactMetal_light_001 coin-2=impactMetal_light_002 coin-3=impactMetal_light_004
ting=impactMetal_light_003 glass=impactGlass_light_000 bell=impactBell_heavy_000
coins-pouch=handleCoins coins-small=handleCoins2 leather=handleSmallLeather latch=metalLatch
water-swirl-1=rubberduck-splash_06 water-swirl-2=rubberduck-splash_13 water-swirl-3=rubberduck-splash_15 water-dunk=rubberduck-splash_04
ui-open=bookFlip2 ui-close=bookClose ui-hover=rollover2 ui-click=click3 ui-deny=impactWood_light_000
hit-1=impactPunch_medium_000 hit-2=impactPunch_medium_003 bodyfall=impactSoft_heavy_003
"
for pair in $MAP; do
  name=${pair%%=*}; src=$SRC/${pair#*=}.ogg
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$src")
  pre="silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.004,aresample=44100"
  # measured in float (pcm_f32le): several originals peak above 0 dBFS, which a 16-bit measurement reads as 0
  peak=$(ffmpeg -hide_banner -nostats -i "$src" -ac 1 -af "$pre,astats=measure_perchannel=none:measure_overall=Peak_level" -c:a pcm_f32le -f null - 2>&1 | sed -n 's/.*Peak level dB: *//p' | tail -1)
  gain=$(awk -v p="$peak" 'BEGIN{printf "%.2f",-3-p}')
  ffmpeg -hide_banner -loglevel error -y -i "$src" -ac 1 -af "$pre,volume=${gain}dB,areverse,afade=t=in:d=0.012,areverse" -c:a libmp3lame -q:a 4 "$OUT/$name.mp3"
  echo "$name <- ${pair#*=}.ogg (${dur}s, gain ${gain} dB)"
done
