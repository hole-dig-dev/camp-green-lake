# Gold Fever — verification

## Automated checks

`npm test` now runs 41 tests. Earlier baseline coverage included 24 tests: 12 original simulation tests, eight hauling tests, two export tests, and two real host/restart tests. They cover deposit sampling, action reach, container limits, panning and cancellation, shared purchases, progression prerequisites, equipment placement, washer recovery, occupied seats/handles, cargo transfers, offline worlds, exports, room isolation, persistence and graceful shutdown. New coverage includes brakes, natural overloads versus teammate steadying, conserved spills, solo/friend recovery, one-player wheelbarrow-to-rocker operation, and configured 1/2/4/8 capacity through disconnects and restart.

## Browser playtests

Two independent Chrome browser profiles exercised the actual game interface and host:

- Joined one Gold Rush crew; walked to the creek and dug with the mouse.
- Confirmed the friend received the same terrain excavation.
- Washed and settled a pan; earned gold and recorded a measured sample.
- Viewed the field map and the other player's character.
- Sold at the assay office and observed the shared treasury.
- Opened the hardware shop and checked affordability.
- Reloaded and restored the same miner, samples, treasury and excavated terrain.
- In Machine Playground, placed a wash plant and drove an excavator.
- Loaded a dump truck occupied by the other player, drove it to the plant, tipped the load, processed the gravel and collected gold.
- Bought an equipment kit through the shop and confirmed the shared deduction.
- Operated the hydraulic rig and observed its larger terrain excavation.
- Entered and left fullscreen with the HUD visible.
- Restored the same miner in a fresh browser profile using the personal prospector pass.

A separate Chrome check joined the same crew through localhost and the public HTTPS tunnel. It verified HTTPS assets, secure WebSocket connection, movement replication, crew chat, and that private host files are not served. The browser checks reported no JavaScript or console errors.

The supplied web-game browser test client also ran, and its gameplay screenshots were inspected. Full-interface screenshots of panning, multiplayer characters, terrain, the shop and machinery were checked visually.

## Mouse control repair — 2026-10-02

The reported failure was reproduced in the Codex browser panel: clicking the world did not grant pointer capture. The local host was also found stopped and restarted. The game now requests capture from the Enter gesture, focuses the game canvas, handles failed capture requests, and provides a visible capture control plus right-button drag-to-look fallback.

Chrome browser checks exercised normal capture and a deliberately rejected capture request. Both checks used actual mouse motion to turn and aim, keyboard movement to leave town, and left-button excavation to acquire gravel and change terrain. They also checked cursor visibility, guide opening/closing, capture release/resume, and that the help text does not block world clicks. Browser errors were empty. The corrected fallback and canvas focus were also observed in the actual Codex panel.

The 15 automated simulation/export/host tests were rerun successfully. Screenshots for native capture, fallback help and dragging were inspected; `mouse-controls.png` shows the updated controls.

## Practical limits

These checks establish a working prototype and its tested play loop. A long Gold Rush session with human players is still needed to tune discovery difficulty, comedy and time to each upgrade. The earlier Internet check used two browser profiles on this host; your friend's computer and connection have not been tested. Two simultaneous rendered browser players were exercised; eight WebSocket clients verified room capacity and shared state, which is not an eight-person gameplay or graphics performance test.

The world uses an editable heightfield, simplified vehicle movement and decorative trees/rocks. Tunnels, overhangs, fuel, maintenance and public matchmaking are future work. Modern machines are deliberate comic escalation beyond the historical setting.

The project includes editable source, independent rules/simulation modules, save data and JSON/OBJ exports. Moving to Unreal requires rebuilding movement, rendering, runtime terrain and engine replication; the architecture guide describes the conversion and the contracts to preserve.

## Physical hauling and crew capacity — 2026-10-02

The new two-browser Gold Rush playthrough used actual digging and keyboard/mouse actions: six 24 kg buckets loaded the loaner to 144 kg; a sprinting turn naturally tipped it and knocked the driver down; a friend held H to help them up. The barrow and pile retained 144 kg. The friend righted it, recovered 24 kg with X, panned the recovered paydirt for gold, and reloaded without losing the shared spill. Browser errors were empty. The first run found ambiguous pickup selection; X now prioritizes spills and the complete rerun passed.

A one-browser Machine Playground run tested safe 60 kg hauling, parking, an overloaded 120 kg turn, Space self-recovery, righting the cart and retrieving gravel. First-person boots were checked visually; fixed world terrain occluding the boot model. This verifies the solo hauling/recovery path, not the complete future solo campaign.

The original two-browser machinery route was rerun: excavator loading, friend-driven truck hauling, automatic wash plant processing, gold collection, a purchase at the configured price, hydraulic excavation, fullscreen and pass-based identity restoration all passed with no browser errors. Native pointer capture and denied-capture drag fallback were also rerun with actual mouse aim, movement, digging and guide controls. The supplied skill browser client ran and its final screenshot/state were inspected.

Development evidence: work/hauling-playtest, work/solo-hauling, work/hauling-presentation, work/haul-final-skill, work/mouse-test and work/playtest. These are scripted playthroughs; spontaneous human coordination, laughter, clip quality and 15–25 hour campaign balance remain unmeasured.

## Hidden console — 2026-10-02

Version 0.3.0 adds a hidden ~ / backtick console. `npm test` now runs 31 tests. Seven new tests cover invalid/malicious command rejection, integer-cent money and banking, cargo-preserving teleports, bookmarks/back/quoted player names, flight/collision traversal and safe landing, real speed changes/reset, and equipment/container limits.

Two independent browser clients tested the actual panel: hidden initial state, Shift+Backquote opening, focus, money add/set and bank replication, teleport camera synchronization, bookmarks, typing without movement or game shortcuts, history/autocomplete, flight ascent/forward movement, reset, upgrades, spawned truck, teleport-to-equipment, normal F entry, test gravel, usable hardware shop, invalid input, clear, Esc and reload persistence. No browser errors were reported. The skill browser client also ran with a normal movement burst; screenshot and state were inspected.

Artifacts: work/console-playtest and work/console-skill. The map remains 224 × 224 metres. These commands do not implement the remaining campaign systems.

## Version 0.4 physical digging verification

- All 37 automated tests pass: previous 31 plus six soil tests covering deliberate pull, rejected impulses, conserved throw/miss/recovery, partial bucket overflow, teammate bucket/cart/washer catches, persisted flight/placed buckets and eight simultaneous loads.
- Two independent browser clients on the real host completed the new shovel -> catch/miss -> recover -> pan flow using real mouse/keyboard events. The friend saw held loads, clods and bucket fill. A stationary held click did not excavate. Denied pointer capture still allowed left-drag lifting and right-drag aiming; console typing remained isolated. Reload retained resources. No page or browser console errors.
- Artifacts: work/soil-playtest/report.json and 01–06 PNG/JSON captures; skill client artifacts in work/dirt-final-skill. Screenshots were visually inspected, including loaded blade, catch, flying dirt, panel fallback and the front of the revised prospector model.
- Scope: simple authoritative parcel physics and heightfield digging. No general rigid-body tool grabbing, per-grain terrain, underground excavation, conveyors or autonomous haul routes yet. Reference research is official promotional footage/description review; not a played reference-game session or human comedy validation.

## Midair catch and face mud — version 0.5, 2026-10-02

All 41 automated tests pass. Four new scenarios verify actual catch-lob trajectories into a moving held bucket, failed catches and exactly 3000 ms mud expiry, friend-only face impacts versus harmless distant misses, and full-bucket overflow. All preserve dirt and gold.

Two independent Chrome profiles exercised real mouse and keyboard input: lifted one scoop, held C, released it, moved the bucket AFTER throwing, and caught all 6 kg. A second scoop missed, splatted the thrower's face, left the friend's view clear, and cleared automatically after three seconds. Both clients saw the catch stance. Missed soil remained recoverable. Denied pointer capture repeated the catch successfully and retained right-drag mouse look. Runtime and console errors were empty. Screenshots inspected: `work/catch-playtest/01-solid-bucket.png`, `02-midair-catch.png`, `03-face-splat.png`, `04-clear-again.png`, and `05-panel-catch.png`. The skill's standard browser client was also run and its screenshot inspected.
