# Gold animation checks

`run.sh <port> <script> [args...]` starts its own development server with the event director disabled. It cleans up only that server. Use ports 4800–4899.

`verify.cjs <port>` checks the real first-person pan/sifter reward path, rejects concurrent starts, checks gold instance size and full opacity every rendered frame, ray-tests actual sand coverage and exposure behind the riffles, confirms zero-reward batches invent no gold, and checks that completion, temporary materials, particle pools and camera controls are cleaned up.

`fxshots.cjs <port> <output-dir> pan|sift` captures frames at half-second intervals, recording their actual cinematic times. `grid.py` composes those screenshots with time captions (requires Pillow). `record.cjs <port> pan|bucket <output.mp4>` records the full dig/walk/process loop and uses ffmpeg to encode it at the CDP frame timestamps. It verifies that the interaction actually starts and finishes.

See [out/README.md](out/README.md) for the comparison media and reproduction commands.
