#!/bin/bash
# Catch the "black screen" class of bug before a browser does: joins every local <script src> in public/index.html,
# in load order, and parses the result as ONE script. The page's classic scripts share one global scope, so a
# top-level let/const/class declared in two files (easy to do when two feature branches merge) is a SyntaxError
# that kills the later file at load -- and parsing them joined together reports exactly the same error, with the name.
# Also lists top-level function names declared twice (not an error: the later one silently replaces the earlier).
# Usage: scripts/check-globals.sh   (from the repo root; exit 0 = clean)
set -u
out=$(mktemp --suffix=.js); trap 'rm -f "$out"' EXIT
grep -o '<script src="[^"]*"' public/index.html | sed 's/<script src="//;s/"$//' | grep -v '^http' | while read -r s; do cat "public/$s"; echo; done > "$out"
dups=$(grep -oE '^function [A-Za-z_$][A-Za-z0-9_$]*' "$out" | sort | uniq -d)
[ -n "$dups" ] && echo "warning: top-level function declared twice (the later one wins): $dups"
node --check "$out" && echo "OK: no duplicate top-level declarations across $(grep -c '<script src="[^h]' public/index.html) scripts"
