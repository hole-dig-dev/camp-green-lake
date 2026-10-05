# Gold Fever — verification

## Overall materials — 0.15, 2026-10-04

All 107 existing tests pass. Final browser work/textures-final exercises a real mouse plant/pull/toss shovel gesture, checks changed terrain, visits camp, gravel, the canyon and a real underground room with a support crafted/placed through validated rules, then returns and walks at camp. All twelve maps decode; failed-map count and browser error arrays are empty. JPEG responses have the correct image/jpeg type. The standard web-game client in work/textures-skill-final also ran; its gameplay image and state were inspected, along with the final surface/canyon/mine screenshots.

Visual checks caught an immutable GPU storage issue: replacing a tiny fallback with a 1K image reported success but kept the plain image on screen. Related texture allocations are now disposed before upgrade. First-person material cloning retains shader callbacks. Custom shovel/roof geometry now has UVs; metal texture detail is visible on the blade. A first mine screenshot fixture teleported into solid rock and was corrected to the actual cleared lower room; the final image shows the underground rock and support. No user-room terrain edits or QA grants were made in XCULAFY6.

Sources, signature, byte-size and published checksums were checked for twelve JPEGs downloaded from Poly Haven's official HTTPS endpoints. The rejected grassy-rock candidate was replaced. Defender scanning was unavailable (access denied), so no antivirus clearance is asserted. No new executable/software installation was needed. Longer sessions and performance on actual player GPUs remain unmeasured; these runs use software WebGL.

## Buried finds and Motherlode — 0.14, 2026-10-03

All **107 automated tests pass**. Seven new cases cover seeded persistence and snapshot concealment, real starter excavation uncovering a coin, range/free-hand/ownership checks, directional rod signals and purchases, three-slot capacity and friend drops, saved ownership and reset preservation, single shared payout alongside normal gold, rubble occlusion, and real solo excavation down to the Motherlode with rope ascent. An eight-socket host test verifies exclusive Motherlode ownership, restoration of its carrier after restart, one payout and a shared completed objective. These are network clients, not eight human playtesters.

Two browser profiles used the real shop and 5 equip, surveyed via view sweeps, uncovered a coin with actual left-mouse plant/pull/toss gestures, collected it with E, handed it to a friend with G/E, reloaded the carrier, and sold it at Bill. Both saw the same object and collection progress. A separate solo browser retrieved the actual seeded Motherlode from a host-validated excavated pocket, climbed its rope using keyboard input, sold it and displayed the completed field-book goal. Setup shortened travel/gear with QA grants and teleports in private rooms; the deep pocket was made through validated mining actions, not a premade visual prop. Error arrays are empty in successful runs.

Screenshots/state inspected: work/relics-playtest, work/relics-mother and the standard skill client in work/relic-skill-final3. Fixed the new renderer's Three import and a stale-snapshot fixture assumption; close nameplates now yield to the existing E prompt so they do not obscure finds. Early UI captures during modal fade were replaced with a fully visible field book. The solo escape exposed a rope snag when approaching a shaft from the side: climbing now gently centers the miner on the rope, checking body clearance throughout. The regression and real keyboard escape both pass with the Motherlode. Longer economy balance, human treasure-search pacing and arbitrary tunnel performance remain playtesting work. Finds use inventory and floor placement; general rigid-body object grabbing remains future work.

## Automated checks

`npm test` now runs 107 tests. Earlier baseline coverage included 24 tests: 12 original simulation tests, eight hauling tests, two export tests, and two real host/restart tests. They cover deposit sampling, action reach, container limits, panning and cancellation, shared purchases, progression prerequisites, equipment placement, washer recovery, occupied seats/handles, cargo transfers, offline worlds, exports, room isolation, persistence and graceful shutdown. New coverage includes brakes, natural overloads versus teammate steadying, conserved spills, solo/friend recovery, one-player wheelbarrow-to-rocker operation, and configured 1/2/4/8 capacity through disconnects and restart.

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

The world uses an editable heightfield outside the new volumetric mine claim, simplified vehicle movement and decorative trees/rocks. The 0.6 mine provides real tunnels and ceilings. Cave-ins, fuel, maintenance and public matchmaking remain future work. Modern machines are deliberate comic escalation beyond the historical setting.

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


## Real mines and solo hoisting — version 0.6, 2026-10-03

All **53 automated tests pass**. Eleven mine scenarios cover exposed 3D wall/floor/ceiling removal, reach and blocked-ray validation, safe capsule collision, ladder ascent/descent/idle grip, purchases and preserved invalid-placement kits, complete solo cart/cage material conservation, shaft extension and steam lifting, manual pause/reversal, an extended excavated rail gallery, exclusive cart control, disconnected cart recovery, clod catches/overflow at the correct depth and cross-level retrieval rejection. Export tests verify exposed underground faces and valid OBJ indices.

The new real-host mine test joins eight WebSocket clients, verifies every crew member receives the same 3D cut while another room does not, restarts the host with a loaded cage mid-shaft, and recovers it with one player without losing cargo or raw gold. It also migrates a pre-mine save whose miner stood inside the new claim, placing the miner safely at the entrance. This is a network/state test, not an eight-person rendered playtest.

A one-player Chrome run used the real shop, kit placement, keyboard controls and shovel mouse gesture: bought mine equipment, descended and climbed the ladder, cut a real wall and caught 12kg, entered the new opening, loaded/pushed/braked a cart, called and boarded the cage, manually hoisted its load to the surface, retrieved and washed the material, and extended the shaft to an 18m-deep landing. A second independent browser received the same new cells and shaft level; reloading restored the excavations, rails and loaded equipment. QA console teleports shortened travel and aligned the narrow tunnel entry; they did not bypass the mouse excavation, hauling, cage or processing controls. No browser console or runtime errors.

A separate visual construction run used ordinary host-validated mining/deploy actions and QA teleports to excavate an eight-metre gallery from solid rock, widen it to two metres, build six connected rail sections, and move a cart holding 192kg through it. The final screenshot shows the resulting walls, ceiling, rails and cargo. This is persistent excavated geometry, rather than a precut scene. A subsequent UI check verified grouped kit quantities and one-section consumption, actual short K input for automatic steam travel to the deeper landing, camera/server depth agreement, and exit at that landing. Short key taps now send input immediately rather than waiting for a rendering frame.

Existing two-browser catch/mud checks passed again after the input changes: mid-flight carried-bucket catches, misses, three-second vision clearance, unaffected friend vision and denied pointer capture/right-drag fallback. The standard web-game client also ran, with screenshots and text state inspected.

Artifacts in the development workspace: `work/mine-playtest/report.json`, `work/mine-gallery/report.json`, `work/mine-final/report.json`, `work/catch-playtest/report.json`, and `work/mine-skill-input`. Included screenshot: `mine-gallery.png`. Current bounds and deferred mechanics are detailed in MINE-GUIDE.md. Long-session progression balance, human mouse feel and eight-person performance still need playtesting.


## Smooth aim-directed mines — version 0.7, 2026-10-03

All 56 automated tests pass. New geometry checks excavate a diagonal descending passage using exposed-surface ray hits, walk down it and back uphill, dig a shaft more than ten metres deeper and climb out using a purchased rope, and verify ceiling-bounced dirt settles on the correct floor with conserved cargo. Existing rail/cart/manual and steam cage tests remain green. Eight WebSocket clients share continuous cut events and restore cuts/cargo after host restart. JSON/OBJ export tests include a real continuous cut and legacy cells.

Browser verification used fresh QA rooms, not XCULAFY6. Actual WASD traversed a descending diagonal passage and returned uphill. B placed a rope at the miner's feet, host-validated shovel plant/lift/throw actions deepened the personal shaft, Ctrl descended and Space climbed back out without a helper. A second browser and reload received identical cut counts. Another full UI cycle used ordinary shop/B placement, real mouse shovel pulls, recovered a missed underground catch with X, walked into the cut, loaded/pushed/braked a cart, called/boarded/cranked/exited a cage alone, retrieved and washed the same material, extended the shaft and verified a second browser plus reload. Runtime and console errors were empty. QA grants/teleports shortened setup/travel; they did not create the excavation geometry.

The standard develop-web-game client also ran successfully. Screenshots were inspected for curved walls, ceilings, slope transitions and intact mine fixtures; smooth-mine.png shows the resulting excavated passage. A ceiling-floor query bug discovered during browser checks was fixed and covered by a regression test. One network test was corrected to wait for the cage's stopped state at its landing before boarding.

Limits remain: continuous excavation is confined to the 48x48m mining claim, to 38m beneath its surface, with a 4,000-cut cap. The surrounding valley is a heightfield. Mesh detail is sampled at 0.5m and is still a compact stylized prototype. Cave-ins and structural timbers remain future work.

## Timber, cave-ins and picks — versions 0.8–0.9, 2026-10-03

The 70-test suite includes nine forestry/support scenarios and five tool scenarios: validated five-hit tree cutting, delayed/partial log collection without duplication, friend wood sharing, four-log crafting and no cash substitute, four-metre frame coverage, structural warning/collapse timing, undermined feet, actual collidable rubble, solo escape without cargo loss, sterile rubble removal, offline freeze, personal pick prerequisites/prices, increasingly larger walkable true cuts, minimum gesture timing/pull, captured planted equipment, heavy parcel conservation, capacity rejection without edits, and faster heavy-pick rubble clearing. The eight-client real-host test also persists forest, wood, frames, rubble and personal pick upgrades through restart. It is not an eight-person rendered performance test.

Browser timber QA actually chopped three trees with the mouse, collected 18 logs, crafted and placed four frames using B, shared dropped wood with an independent browser, then watched warning/cracks/dust turn into collidable rubble. Three actual shovel gestures cleared the fall and a crafted frame arrested renewed danger. Teleports shortened travel; prepared galleries used host-validated cuts, and one warning site started at stress 69 to shorten the wait. No changes were made to user room XCULAFY6. Results: work/timber-playtest/report.json.

Browser tool QA used actual shop purchases, equipped each tool with 4, pulled with the mouse to load 14/18/24kg, tossed each load and walked normally into the resulting excavations. An independent browser received cuts and equipped tiers; reload kept the personal upgrades without granting tools to the friend. A QA cash grant shortened earning and teleports shortened travel; normal prerequisite, purchase, excavation and movement controls were exercised. Browser console/runtime errors were empty. Results: work/tools-playtest/report.json. The standard develop-web-game client also ran and its screenshot/text were inspected. Included reference screenshots: timber-supports.png, roof-warning.png and hand-tools.png.

Limits: tree falling is animation rather than rigid-body impacts. Support coverage and roof danger are regional approximations. Parcel mass is a deliberately bounded gameplay abstraction of the larger geometric cut. Long-session economic balance, human pick feel, eight-person performance and exact historical tool efficiency remain unverified.


## Mouse-operated excavator — version 0.10, 2026-10-03

Eight new automated cases cover joint clamps/nonfinite input, spring lag/settling and shared geometry, true teeth contact and minimum pull, ownership/protected-ground/capacity/moved-away rejection, duplicate scoop prevention, truck catches and missed piles with gold/mass conservation, bounded flicks, stale input/exit/JSON persistence, and a real host planting acknowledgement with eight-client joint/cut replication plus loaded-bucket recovery after restart. The full current suite contains 78 tests.

The browser run exercised actual mouse swing/raise, wheel folding, C curling, real plant/pull excavation, visible 180kg load, Shift adding a second scoop, independent-browser pose/load sharing and occupied-seat rejection, a real mouse fling with all 360kg recoverable, exit/reload, and Codex-style denied-capture arm movement/right-drag looking. Runtime/console errors were empty. QA console spawning/teleports shortened setup; excavation and arm controls used normal input. User room XCULAFY6 was not used. Evidence: work/excavator-playtest/report.json. The standard develop-web-game client ran and its screenshot/text were inspected. Included excavator-arm.png shows the articulated bucket.

Browser QA found a missing excavatorPlant result acknowledgement, which has been fixed and covered by the real-host regression. Visual QA removed the operated cab’s whole-screen windshield tint. A test-only absolute-mouse recentering issue was corrected to use relative motion before the successful run. The physics remain a damped joint model and conserved dirt parcels; arm collision with trees/players and a continuous mechanical stress solver are not implemented.


The separate two-browser delivery run also passed: a real slow mouse release from the raised articulated bucket delivered 180kg into a truck bed, followed by a further actual dirt scoop and E transfer to reach 360kg. Truck placement/teleports and an initial 180kg cargo grant shortened this delivery setup; the main browser run independently verified normal scoop acquisition. Runtime/console errors were empty. Evidence: work/excavator-delivery/report.json; included excavator-truck.png. Earlier delivery retries selected an old QA truck and were corrected to use a fresh room and latest truck; actual catches already worked.

## Excavator stability hotfix — 0.10.1, 2026-10-03

Reproduced the reported crash-like disconnect with sustained mouse events in an actual Chromium client: close 1008, reason Too many messages, and loss of the driver's seat. The old mouse handler sent every event in addition to the periodic stream, exhausting the server's 45 messages/s budget. No renderer exception occurred in that reproduction. The fixed client coalesces mouse and wheel targets into its regular 20 Hz stream, while discrete gestures still dispatch immediately. The original 650-event replay stayed connected; a stronger 5200-mouse-event plus 5200-wheel-event test also stayed in the seat, including driving/steering, right-look and exit/re-enter, with no WebSocket closures or browser errors. This test injects DOM mouse samples to model a high polling rate; the ordinary browser replay independently uses actual mouse inputs.

One continuous smoothed vehicle/joint pose now drives both the rendered machine and cab, instead of jumping the camera between 10 Hz snapshots while the chassis interpolates separately. Upper-house roll was removed because its cab displacement did not match the camera. Fast upward pulls wait for the minimum plant age before sending a scoop. C no longer also changes on-foot catch look while operating the excavator. Fixed an erroneous rejection after a successful E transfer to a washer; the new conservation/acknowledgement regression passes.

The complete real-mouse scoop/add-scoop/dump/fling/second-client/reload/Codex-fallback replay passed with errors empty. Standard skill client screenshot/state and loaded-bucket screenshot inspected. All 79 automated tests pass, including the eight-client real-host restart case. Private QA rooms used; XCULAFY6 was not mutated for setup. Software WebGL browser QA establishes stability/functionality, not a hardware performance benchmark or proof against every possible browser crash.

## Mechanical automation/feedback — 0.11, 2026-10-03

Seven new engine cases cover prerequisite purchases and single-machine motor fitting/packing, solo unattended washing and export, physical feeder intake/output and gold/mass conservation, missed-output piles and solo jam clearing, overloads and stale/distant versus friend help, receiver/clod limits, and runaway cart braking without cargo loss. One new real-host case replicates the powered rocker/conveyor flow to eight sockets and restores both after a host restart. The full suite passes 87 tests.

Actual browser inputs confirmed normal shop purchases, B placement/fitting, unattended washing while walking away, packing/refunding both kits, E hopper load, physical belt-to-sluice gold recovery visible to a second browser, and a parked wheelbarrow’s G dump auto-intake. The focused jam replay confirmed a real friend H hold, shared jam/sneeze, feedback/audio handling and reload. A normal shovel catch replay confirmed 6kg midair capture with feedback event handling in both clients, plus real shovel planting/pulling beside a loaded powered rocker. Browser error arrays are empty for those successful cases. Standard skill client screenshot/state inspected.

QA shortened the economy with cash/test-gravel grants and used private rooms, travel, and a spawned barrow/belt; these are not an end-to-end earned progression playtest. Initial UI fixture failures came from moving the cursor after setting aim, releasing an unbraked cart, and clicking E while a nearer loose pile was still the contextual target. The fixture parks before release and waits for intake. The user room XCULAFY6 was not used for grants or terrain edits. Controls intentionally remain demanding. Procedure-generated audio was exercised without runtime errors; subjective audio feel and the complete upgrade economy still require human play.

## Crooked Gorge - 0.12, 2026-10-03

All 93 automated tests pass, including six canyon cases: complete solo descent/return, bridge entry/crossing/falling, steep-wall collision, diagonal cuts and deep excavation, open-air versus elevated roof stability, freshly excavated floor traversal, and map-reset material/progression preservation. The full suite retains the real-host eight-client checks for earlier systems.

Actual browser WASD walked the entire west descent to the 38m floor and returned without flight, speed boosts, jumping or a hoist. The final focused replay crossed the full bridge after its entry lip was fixed; five real mouse plant/pull/toss cuts opened a walkable wall tunnel. A second browser received the same brushes; reload restored them. Error arrays are empty. Standard web-game client screenshot/state inspected. Test grants in private rooms shortened tool progression; these are not a full earned-economy playthrough or a hardware performance benchmark.

User room XCULAFY6 was backed up and reset after QA, with treasury, identities, upgrades, wood, equipment, carried material and loose ore verified unchanged in total. Old dig cells and cuts were cleared, forest restored, vehicles returned to camp, and loose piles gathered beside camp. The Codex browser panel rejoined that room and visibly displayed Crooked Gorge, the west descent and bridge on M, with the preserved treasury. The map remains 224m square; the canyon occupies its northern 208m span. Vehicle excavation remains in the surface area; the existing cage hoist is still tied to the old shaft.

## Canyon miner guards - 0.13, 2026-10-03

All **99 automated tests pass**. Five new shared-rule cases verify the fixed four-guard roster for solo and larger crews, offline suspension, sight/terrain collision, pursuit and warning timing, one-hit turn-around attacks, conserved spilled dirt/gold, temporary immunity against chain hits, dodging, full-bucket escape speed, blocked sight and placed-bucket handling. A new real-host case joins eight sockets, observes the same dance target and spill, then restarts the host and verifies four saved guards, conserved 24kg/1000mg test cargo, and cleared attack impulses. This is eight network clients, not eight human players or a rendered performance benchmark.

Two independent browser profiles exercised a solo chase, visible warning, real knockback and spill, then actual Shift+W escape from the canyon. A second player saw the same guard turn and dance on the first; hip pose sampling confirmed motion between snapshots. Reload retained four models without duplicate spawns. Screenshots of the actor, warning/impact, escape and friend's viewpoint were visually inspected; runtime/console errors were empty. Economy/travel setup used test dirt and teleports in a private room. Standard web-game client screenshot and text state were also inspected.

Artifacts: work/guards-playtest/report.json, screenshots 01-06, work/guards-skill-final and work/guard-tests-final.txt. Included guard-miner.png and guard-twerk.png. These are functional checks; comedy timing and long mining-session pressure still need human play. Bounded floor navigation does not guarantee routes through every narrow or stacked excavated tunnel. The live host reports 0.13.0 with an empty server-error log; the user's XCULAFY6 panel was refreshed and rejoined without another map reset or QA grants.

## Sculpted characters and vehicles - 0.16, 2026-10-04
All 107 automated tests pass. Focused browser QA in a private room uses one rendered Chrome/SwiftShader client and a real WebSocket friend: rounded player model, shared wave/movement, truck cab entry/driving/exit, mouse-driven excavator pivots and hydraulic model pass with no runtime or console errors. Actual solo guard chase/warning/hip-check/spill/dance/escape passes. Real excavator mouse/wheel/C controls, 180kg scoop, 360kg add-scoop and physical fling pass. The standard web-game client ran; screenshot and text state were inspected.
Screenshots were inspected for shapes and operating views. Fixed tire tread orientation, rounded-edge sampling and bucket lip alignment. Guard replay now records pose samples across rendered frames; fixed-duration dance/escape checks were unreliable under software rendering. The first attempt at two simultaneous rendered profiles timed out during second-tab navigation, so these checks do not establish simultaneous rendered-client performance. Hardware frame rate, eight human players and subjective art quality remain unverified. XCULAFY6 was not used for test grants, resets or excavation. No simulation/save-schema changes or new asset downloads.

## Western art direction - 0.17, 2026-10-05
All 107 automated tests pass. Private rendered Chrome/SwiftShader plus a real WebSocket friend verifies remote miner/wave/movement, truck entry/driving/exit, excavator mouse pivots and all three heavy vehicles without console/runtime errors. Real shovel plant/pull/toss, edited dirt, canyon surfaces, indoor rock/support lighting and camp return pass again after the hand-prop replacement. Actual authored-tree chopping, stump/log rendering, six-log pickup and reload pass with errors empty. All twelve PBR maps and the HDR environment report ready; forest reports three authored tree variants without asset failures. The shipped skill client (local copy changed only to resolve the existing Playwright import) ran successfully; screenshot and text confirm a connected goldfield. Its first concurrent attempt timed out before clicking the lobby; the sequential final replay succeeds. Forest fixture fixes wait for join state and handle null state during reload.

The user's Codex browser panel was refreshed/rejoined as Nugget Ned; the treasury displays $41,431. Saved cash, surface cells, mine brushes/tracks/supports, forest state and equipment counts match the exact pre-art backup. No QA grants or digging/reset in that room. Screenshot western-art.png shows the actual live view. This is a functional/visual prototype check, not an eight-human performance benchmark or player approval of the art direction.
