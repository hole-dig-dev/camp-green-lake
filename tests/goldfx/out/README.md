# First-person gold work review

The four contact sheets compare the previous animation at `6266491` with this change. Captions use the actual animation clock; completed frames show the resulting reward. Each capture uses its own fresh game, so random payouts differ.

- `before-pan-grid.jpg` / `after-pan-grid.jpg`
- `before-sift-grid.jpg` / `after-sift-grid.jpg`
- `pan.mp4`: bare hands → dig → carry sand back → wash the pan.
- `sifter.mp4`: shovel → dig → carry sand back → pour and dry-sift.

Videos are 1280×720, 30 fps, encoded from CDP timestamps at real speed. Screenshots and video review frames were inspected during iteration. Chromium rendered on AMD Radeon 760M / RADV, verified with the GPU preflight. MP4s and test logs remain local and are excluded from git.

Rebuild assets with `cd art/blender && python3 bx.py goldfx.py` (or `python3 bx.py goldfx_sediment.py` to rebuild only the new sand cover). This saves the authoring scenes in `props.blend` and copies the exports into `public/models/`; the camper rig/export is untouched.

Reproduce from the repository root:

```sh
GOLDFX_BASELINE=1 bash tests/goldfx/run.sh 4801 tests/goldfx/fxshots.cjs 4801 tests/goldfx/out/before pan
GOLDFX_BASELINE=1 bash tests/goldfx/run.sh 4802 tests/goldfx/fxshots.cjs 4802 tests/goldfx/out/before sift
bash tests/goldfx/run.sh 4803 tests/goldfx/fxshots.cjs 4803 tests/goldfx/out/after pan
bash tests/goldfx/run.sh 4804 tests/goldfx/fxshots.cjs 4804 tests/goldfx/out/after sift
python3 tests/goldfx/grid.py tests/goldfx/out/before pan tests/goldfx/out/before-pan-grid.jpg
python3 tests/goldfx/grid.py tests/goldfx/out/before sift tests/goldfx/out/before-sift-grid.jpg
python3 tests/goldfx/grid.py tests/goldfx/out/after pan tests/goldfx/out/after-pan-grid.jpg
python3 tests/goldfx/grid.py tests/goldfx/out/after sift tests/goldfx/out/after-sift-grid.jpg
bash tests/goldfx/run.sh 4805 tests/goldfx/record.cjs 4805 pan tests/goldfx/out/pan.mp4
bash tests/goldfx/run.sh 4806 tests/goldfx/record.cjs 4806 bucket tests/goldfx/out/sifter.mp4
bash tests/goldfx/run.sh 4808 tests/goldfx/verify.cjs 4808
npm test
bash tests/carry/run.sh 4810 tests/out start-with-nothing.cjs
bash scripts/check-globals.sh
```

`GOLDFX_BASELINE=1` pins the previous revision; another git revision can also be supplied. Raw frames and interim review sheets stay local and are excluded from git.
