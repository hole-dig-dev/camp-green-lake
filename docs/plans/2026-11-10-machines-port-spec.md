# Gold Fever v0.17 machines: functional spec, target-codebase facts and port design

All Gold Fever (GF) paths are relative to `/home/botuser/cgl-wt/gold-fever/gold-fever/`. All Camp Green Lake (CGL) paths are relative to `/home/botuser/cgl-wt/fable/`. I read everything and modified nothing.

**Two facts shape the whole port:**
- **GF has no 3D model files for any machine.** Every vehicle and washer is built in code from Three.js primitives (`public/vehicle-model.mjs`, `public/scene.mjs` `machineModel`). `ASSETS.md:18` confirms it. The only `.gltf` files in GF are nature props.
- **CGL already has a port plan.** `docs/plans/2026-10-12-gold-fever-port-design.md` makes the excavator and truck "Phase 4" and the hydraulic rig "Phase 5". Phase 3 (washers) and the jeep's sand tub are already in CGL (`84-camp.js:17`, `88-jeephaul.js`).

## Part A. Gold Fever: shared foundations

### A.1 World, terrain and gold (`shared/world.mjs`)
- **Map and grid:** the map is 224 m square. Terrain is a 2 m cell grid (`STEP=2`, `GRID=112`, lines 3-4).
  - `toCell` rounds to the nearest vertex (line 24); `fromCell` goes back (line 25).
  - Ground height is `baseHeight(x,z)` minus the cell's `depth`, bilinear between vertices (lines 26-34).
- **Terrain state:** `room.cells["ix,iz"] = {depth, digs}`.
  - Depth is capped by `rules.world.maxDepth = 5.8` m (`rules.json`).
  - `digs` is the number of scoops taken from the cell's centre; it re-seeds the luck roll.
- **Off-limits ground:**
  - Town: `protectedGround` is x in (-57,-20) and z in (39,78) (line 35).
  - The mine claim: `inMine`, in `mine.mjs`.
  - `canWalk(x,z,r)` only checks the map edge (|x|,|z| > 109) and three building boxes (lines 36-40).
- **Gold per scoop:** `goldInScoop(seed,ix,iz,depth,digs,mass)` (lines 47-62).
  - Base grade is `exp(-(d/15)²)·0.0009` g/kg, where d is the distance to the river.
  - Four seeded deposits each add `footprint·layer·0.048`. The layer term peaks at that deposit's `depth`, which is 0.65-2.25 m.
  - Below 3.5 m the grade is multiplied by 0.025.
  - `mg = grade·mass·1000·(0.2 + luck·1.6)`.
  - If luck < 0.28 and grade < 0.002, mg is 0. If luck > 0.991 and grade > 0.002, a nugget bonus is added.
  - `gradeName` maps grams per kg to Barren / Trace / Promising / Pay dirt / Rich.
- **Cargo is conserved** (`shared/cargo.mjs`). A load is `{mass, goldMg, x, z}`.
  - `addCargo` mass-weights the x,z position and sums the gold.
  - `takeCargo` takes gold in proportion to the mass taken. Gold is never created or lost in transfer.

### A.2 Flying dirt and receivers (`shared/soil.mjs`)
- **Clods:** each is `{id,x,y,z,vx,vy,vz,age,bounces,cargo,owner}`. They are simulated on the server in `tickSoil` (line 87).
  - Gravity is 9.8, in sub-steps of 0.02 s or less.
  - Hitting the ground: `vy` becomes `|vy|·0.19` and horizontal speed is multiplied by 0.45.
  - A clod settles into a pile after 3 bounces, when slower than 0.5 m/s, or after 8 s.
- **Receivers** (`soilReceivers`, line 72) catch a clod that crosses the receiver's height Y downward within its radius. Each takes only up to its free capacity; the rest keeps flying.

| Receiver | Position | Catch height | Radius | Capacity (kg) |
|---|---|---|---|---|
| Dump truck bed (line 84) | `v.x+sin(yaw)·1.1, v.z+cos(yaw)·1.1` (1.1 m behind centre) | ground + 2.25 | 1.45 | 2400 |
| Wash plant | 2.8 m forward | ground + 5.15 | 1.5 | 6000 |
| Rocker | — | ground + 1.55 | 0.8 | catalog |
| Sluice / feeder | — | ground + 1.3 | 0.8 | catalog |
| Wheelbarrow | — | ground + 1.22 | 0.75 | 180 |
| Mine cart | — | — | 0.55 | 240 |
| Player bucket | — | — | 0.35-0.43 | — |

- **Misses:** a missed clod becomes a recoverable spill pile `{id,x,z,cargo}` through `looseSoil` (line 24). It merges into an existing pile within 1.1 m.
- **Face hits:** a clod that hits a player's face (0.40 m sphere) muddies their screen for 3 s and drops its load there as a pile.
- **Limits:** the clod count is capped. The excavator refuses to dump above 138 clods; the shovel and feeder stop at about 150.

### A.3 Server loop, networking and saves (`server.mjs`)
- **Tick:** the server runs `tick(room, rules, 0.05, now)` every 50 ms, so 20 Hz (lines 160-172).
- **Snapshots:** a full snapshot per player every second tick, so 10 Hz.
  - Vehicles go out whole. Excavators also carry the full `arm` (current values, target and velocity); for every vehicle only `cargo.mass` is exposed (`simulation.mjs:273`).
- **Client to server messages:**
  - `input`: forward, right, yaw, pitch, sprint, jump, wash, operate, tool, catching, bucketX/Y, help, vertical, plus `arm` (clamped by `armTargets`) (lines 120-127). The client sends it every 50 ms and on key changes (`client.mjs:313`, `:292`). The server treats input as stale after 600 ms.
  - `action` with `{action:{type,...}}`, handled by `act()`.
  - Rate limit: a budget of 100 messages refilling at 0.045 per ms (45 messages per second sustained) (lines 97-101).
- **Server to client messages:**
  - `result`, sent when it has a message, `excavator` or `shovel` set.
  - `terrain {patches:[{key,depth,digs}]}`, broadcast.
  - `effect`, `notice`, `snapshot`, `welcome` (welcome carries `cells`).
- **Saves:** the whole room JSON goes to `data/worlds/<CODE>.json` (lines 43-53).
  - Written every 5 s while players are active, on disconnect and on host stop.
  - On save and load: drivers are nulled, `excavatorPlant`/`shovelPlant` are nulled, carts are parked with brakes on.
  - Vehicles keep x, z, yaw, cargo (with gold), arm (including target), `tipped` and `swing`.

## Part B. (1) Rustbucket excavator

### B.1 State
**Vehicle object** (`simulation.mjs:41`, `makeVehicle`): `{id:'v<n>', type:'excavator', x, z, yaw:-0.8, cargo:{mass,goldMg,x,z}, driver:playerId|null, tipped:0, swing:ms, arm}`.
- `swing` is the time of the last scoop.
- `tipped` is unused for the excavator.

**Arm** (`excavator.mjs:7`, `ensureArm`): `{boom, stick, slew, curl, target:{boom,stick,slew,curl}, velocity:{boom,stick,slew,curl}}`.

**Per-player state:**
- `p.vehicle` is the vehicle id.
- `p.excavatorPlant = {x, z, y, at, vehicle}` records where the teeth were planted.
- `p.digUntil` is the cooldown end time.

**Ownership:** the server simulates everything. The driving client only predicts its own vehicle position (`client.mjs:165`) and sends arm targets.

### B.2 Arm constants (`excavator.mjs:4-5`)

| Joint | Limits | Default |
|---|---|---|
| boom | [-0.2, 1.05] rad | 0.35 |
| stick | [0.45, 2.05] rad | 1.3 |
| slew (turret turn, relative to hull yaw) | [-2.5, 2.5] rad | 0 |
| curl | [0, 1] | 0 |

- Boom length 3.6 m, stick length 3.1 m.
- Scoop pull threshold `ARM.pull = 36`, measured in accumulated upward mouse pixels.

**Spring update** (`tickArm`, lines 16-24), run every server tick with `input.arm`:
- Sub-steps of 0.016 s or less.
- `load = clamp(cargo.mass/720, 0, 1)`.
- Stiffness is `32 - 7·load` (65 for curl). Damping is 7.5 (11 for curl).
- Acceleration is `stiffness·(target - value) - damping·velocity`.
- Velocity is clamped to ±3 rad/s.
- At a limit the joint is clamped and its velocity becomes `-0.25×`.
- A stale or empty input keeps the old target, so the arm settles where it was aimed.

**Geometry** (`excavatorPose`, lines 8-15). In the hull's local frame -Z is forward, and the turret yaw is `yaw + slew`. Local (x,y,z) maps to world `(v.x + cos·x + sin·z, ground + y, v.z - sin·x + cos·z)`, where ground is the height at the vehicle centre.
- Shoulder: (-0.85, 2.65, -0.8).
- Elbow: shoulder plus `(0, sin(boom)·3.6, -cos(boom)·3.6)`.
- Wrist: elbow plus `(0, sin(boom-stick)·3.1, -cos(boom-stick)·3.1)`.
- Bucket angle `b = 0.15 + curl·1.35`. Teeth (tip) = wrist plus `(0, -0.55·cos b + 0.55·sin b, -0.55·sin b - 0.55·cos b)`.
- Cab eye: local (0.82, 3.25, -1.1).

### B.3 Controls (`public/client.mjs`)

**Getting in and out**
- **F** enters the nearest vehicle within 7 m (`enterVehicle`, line 153). The server checks the 7 m distance and that the seat is empty (`simulation.mjs:164-170`).
- On entry the player is placed at the vehicle centre, `ensureArm` runs, and the client copies `armAim` from `arm.target` with `local.pitch = 0.10` (`client.mjs:89`).
- **F** again exits and puts you 4 m out at `(x + cos(yaw)·4, z - sin(yaw)·4)`, which is the hull's local +x side.

**Driving** (identical for all three vehicle types; server `simulation.mjs:214-220`, client `client.mjs:165`)
- W/S give `throttle` -1..1. A/D steer, but only while throttle is not 0: `yaw -= steer·dt·0.85·sign(throttle)`, so 0.85 rad/s, reversed when backing.
- `speed = cfg.speed·throttle·(1 - mass/capacity·0.18)`. The excavator's `speed` is 3.2 m/s.
- There is no acceleration, braking, momentum or slope effect. The machine just sits on the terrain height.
- Collision is only `canWalk(nx,nz,1.5)`: map edge and buildings. There is no collision with players or other vehicles, no tipping, and no player damage.
- The client predicts the same formula. Reconciliation is in the 10 Hz snapshot handler: an error over 2.5 m snaps, and an error over 0.28 m lerps 22% (`client.mjs:90`).

**Arm by mouse** (`client.mjs:308`). The mouse drives the arm unless the right button is held (right-drag looks).
- `slew -= mx·0.005` and `boom -= my·0.004`, so moving the mouse up raises the boom.
- With **C** held, the mouse curls instead: `curl -= my·0.008`.
- **Wheel:** `stick += sign(deltaY)·0.12` (`client.mjs:305`).
- **R** resets: `armAim = defaults` and the `excavatorReset` action (`client.mjs:293`, `excavator.mjs:30`).
- Right-drag sets `local.headYaw` within ±2.2 (`client.mjs:311`).

**Scoop gesture ("hold left at the dirt and pull up")**
1. **Mouse down** calls `startExcavator` (`client.mjs:25`).
   - If the bucket has a load and Shift is not held, the phase is `carrying` and no plant is sent.
   - Otherwise the phase is `planting` and the client sends `{type:'excavatorPlant'}`.
   - Either way it sets `armAim.curl = 1`.
2. **The server validates the plant** (`excavator.mjs:42-46`):
   - you are the driver;
   - `now ≥ p.digUntil` (otherwise a quiet failure);
   - `mass + 180 ≤ 720`;
   - the tip is within |x|,|z| ≤ 106 and not in town or the mine;
   - the teeth are within -0.9 to +0.95 m of the ground.
   
   It then stores `p.excavatorPlant` and replies `excavator:'planted'`. The client moves to phase `planted`.
3. **While left is held**, each mouse move adds `-my` (upward movement) to `gesture.pull`.
4. **The frame loop scoops** (`client.mjs:313`): when the phase is `planted`, `pull ≥ 36` and at least 220 ms have passed since the press, it sends `{type:'excavatorScoop', pull}`.
5. **The server validates the scoop** (`excavator.mjs:48-51`):
   - a plant exists for this vehicle, `pull ≥ 36`, and 180-8000 ms have passed since the plant;
   - the cooldown has expired;
   - the tip is within 3 m (horizontal) of the plant point, and the hull within 8.5 m of it;
   - there is capacity, the ground is allowed, and the cell is above bedrock.
6. **Release while planted** sends `excavatorCancel`.
7. **Any failed result** while planting, planted or scooping also cancels (`client.mjs:102`).

**Dumping** (`releaseExcavator`, `client.mjs:26`). In the `carrying` phase, releasing the button sends `{type:'excavatorDump', power}`.
- `power` is the latest mouse speed, `clamp(px_per_ms / 2.5, 0, 1)`, but only if the mouse moved in the last 180 ms; otherwise it is 0. A slow release pours; a flick throws.
- **Shift + hold + pull** adds another scoop to a loaded bucket.
- **E** transfers the load instead (`interact`): to a washer within 12 m, or to a truck within 13 m.

### B.4 Effects on the world
**One scoop** (`excavator.mjs:52-58`):
- Digs the cell under the plant point plus its 3×3 neighbours: `depth += 0.48/(1 + 2·distance)`, capped at 5.8. That is 0.48 m at the centre, 0.16 m at the four sides and 0.125 m at the corners, over cells 2 m apart.
- The centre cell's `digs` goes up by 1.
- Load: 180 kg (`digKg`) with `goldInScoop(seed, ix, iz, depthBefore, digs, 180)` mg of gold, positioned at the cell centre.
- Cooldown: `digUntil = now + 2.3 s` (`digSeconds`).
- Sets the curl target to 1, adds 0.7 to the boom velocity (a little kick), and sets `v.swing = now`.
- Stats: `p.stats.dug += 180` and `room.totalDugKg += 180`.
- Broadcasts the 9 `patches` and an `effect {type:'dig', large:true}`.

**Capacity:** the bucket holds 720 kg, so four scoops. Each cycle is at least 2.3 s, plus the time to plant and pull.

**Dump** (`excavator.mjs:32-40`). Requires a finite `power`, a load, and 138 clods or fewer in flight.
- It splits the load into `count = clamp(ceil(mass/60), 1, 12)` equal parcels, launched from the tip with a small sideways scatter.
- Forward speed is `power·13` along the turret yaw.
- Sideways speed is `clamp(slewVelocity, -2, 2)·power·4`, so a turret swing at release adds a sideways fling.
- Vertical speed is `power·5 - 0.4`.
- It resets the curl target to 0 and sets curl velocity to -2.
- Where parcels land is decided by the receivers in A.2: the truck bed, washer hoppers, the wheelbarrow, buckets, or a ground pile.

**Physics limits:** there is no damage to players apart from mud on the face, and no tipping or rollover.

### B.5 Economy
- The excavator costs $4,800 and needs `sluice` unlocked (`requires`).
- Price in cents is `round(price·(1 + 0.65·(crewSize - 1))·100)` (`simulation.mjs:16`).
- Buying it spawns the vehicle at `(-18 + (n%3)·6, 49 - floor(n/3)·10)`. A crew may own 40 machines, vehicles and kits combined.
- There is no fuel or upkeep.
- Sandbox mode spawns one excavator at (-17,43), one truck at (-19,55) and one hydraulic rig at (-12,32) (`simulation.mjs:35`).
- Selling gold pays `floor(goldMg·30/10)` cents ($30 per gram).

### B.6 Presentation
**Model:** procedural, `vehicle-model.mjs:76-102`, with these `userData` handles:
- `upper`: the turret group; `rotation.y = slew`.
- `armRig.boom`: group at (-0.85, 2.65, -0.8) inside `upper`; `rotation.x = boom`.
- `armRig.stick`: child of boom at z = -3.6; `rotation.x = -stick`.
- `armRig.bucket`: child of stick at z = -3.1; `rotation.x = 0.15 + curl·1.35 - (boom - stick)`. Subtracting the parents' rotation keeps the bucket angle absolute, matching the shared geometry.
- `fill`: the dirt ellipsoid in the bucket; `scale.y = 0.35 + min(1, mass/720)·1.4`.
- `piston` (barrel and rod): stretched between (-0.63, 2.25, -0.8) and (-0.63, 2.65 + sin(boom)·2.8, -0.8 - cos(boom)·2.8).
- `wheels`: 8 track rollers, spun by `travel/0.3`.
- `windshield`: hidden for the operator.
- A label reading "RUSTBUCKET".

The posing code is in `scene.mjs:288` (the `render` loop around lines 252-290). Remote clients smooth the arm toward the snapshot with `f = 1 - exp(-dt·22)` (lines 258-262).

**Camera** (`alignCamera`, `scene.mjs:249`): placed at the cab eye from `excavatorPose`.
- Pitch is the angle toward the bucket tip plus `local.pitch`, clamped to [-1.2, 0.4].
- Yaw is `turretYaw + headYaw`.
- Roll is `slewVelocity·0.012`, clamped to ±0.03.
- The camera follows the turret.

**Teeth ring:** a flat ring (radius 0.43-0.49) on the ground under the tip. It is green (#94b861) if the teeth are within 0.95 m of the ground on allowed ground, otherwise orange (#e7a957) (`scene.mjs:264`).

**HUD** (`client.mjs:212`):
- `RUSTBUCKET · m / 720 kg`
- `Mouse · Arm  Wheel · Stick  C + mouse · Curl  Right drag · Look`
- Then one of: `TEETH PLANTED · Pull up to scoop`, or `Hold left + swing + release · Dump/fling  Shift + left pull · Add scoop  E · Transfer`, or `Lower teeth to dirt · Hold left and pull up to scoop`, followed by `R · Centre`.
- Server result messages: "Scoop loaded. Release to keep it; next hold + swing + release dumps. E transfers nearby.", "PAYDIRT AIRMAIL! ..." (dumps with power > 0.3), "Bucket tipped. Aim above a truck bed or washer...". Error texts are at `excavator.mjs:28-51`.

**Sound** (`audio.mjs`): no engine sound.
- `dig`: a noise rustle (0.25 s) plus a 75 Hz tone.
- `catch`: a 320 + 580 Hz tone.
- Plant scraping: a rustle every 150 ms, scaled by `pull`.
- `throw`: no sound.

### B.7 Tests
- `tests/excavator.test.mjs` (8 tests): bounded joints; real lag; the contact plus pull rule; rejection cases; truck-bed catch conserving gold; fling bounds; stale input and save/reload; transfer to a washer.
- `tests/excavator-host.test.mjs`: 8 clients on a real host, with replication, 9 terrain patches and restore.
- `tests/simulation.test.mjs:51`: exclusive seats; excavator-to-truck transfer.
- `tools/test-excavator-browser.mjs`: a Playwright stress test.

## Part C. (2) Dump truck
- **State:** the same vehicle object with `type:'truck'`. `tipped` holds the time of the last unload into a washer; it drives the bed animation.
- **Catalog:** $7,200, needs `excavator`, capacity 2400 kg, speed 10 m/s.
- **Driving:** same model as B.3 (0.85 rad/s turning, load slows it by up to 18%, no physics).
- **Loading:**
  - Excavator dumps caught by the bed receiver (y = ground + 2.25, 1.1 m behind centre, radius 1.45).
  - E transfer from an excavator within 13 m.
  - Shovel or wheelbarrow E from on foot within 6 m.
- **Unloading:** the driver presses **E** near a washer within 12 m. It moves `min(load, washer free capacity)` and sets `v.tipped = now` (`simulation.mjs:180-185`). A truck cannot dump onto the ground and cannot dig ('A truck hauls gravel...', line 76).
- **Model** (`vehicle-model.mjs:57-75`): the chassis and cab sit at -Z (front).
  - `userData.bed`: group at (0, 1.45, 3.55). Its `rotation.x = -sin(t/2·π)·0.65` for 2 s after `tipped` (`scene.mjs:286`).
  - `userData.fill` sits in the bed.
  - 6 wheels (radius 0.7) at x ±1.68 and z -2.5, 1.3, 2.8, spun by `travel/0.7`.
  - Label "DUMP TRUCK".
- **Camera:** first person, eye 3.65 m up, moved 3.15 m forward along yaw (`scene.mjs:249`).
- **HUD:** "Drive alongside a washer. E tips your load." (`client.mjs:220`).
- **Tests:** covered by the excavator truck-bed test and `simulation.test.mjs:51`.

## Part D. (3) The Widowmaker (`type:'hydraulic'`)
- **Catalog:** $35,000, needs `washplant`. Capacity 3900 kg, speed 2.5 m/s, `digKg` 650, `digSeconds` 3, reach 22 m.
- **No arm:** `ensureArm` returns null for this type.
- **Control:** hold the left mouse with the crosshair on ground within 22 m of the vehicle. The client fires `{type:'dig', x, z}` every 3000 ms (`client.mjs:170-179`).
- **Server dig** (`simulation.mjs:69-106`):
  - Checks finite coordinates, distance ≤ 22 from the vehicle, |x|,|z| ≤ 108, not town, not bedrock, and capacity.
  - Loads 650 kg plus `goldInScoop` gold.
  - Cuts 0.8 m over a 5×5 cell area: `0.8/(1 + 2·distance)`. That is 0.8 at the centre, 0.267 one cell out, 0.209 diagonally, 0.16 two cells out and 0.12 at the far corners.
  - Six bursts fill it. It unloads only with E.
- **Model** (`vehicle-model.mjs:86-92`): tracks and an upper body. `upper` is not exported for this type, so it never slews.
  - `userData.boom` is a cannon at (-0.8, 2.95, -0.7). It recoils `sin(t/1.6·π)·0.3` for 1.6 s after `swing`.
  - `userData.jet` is a water strut out to (0, -1.4, -19), visible for 0.7 s.
  - A tank and a `fill`.
- **Camera:** eye 4 m up, 1.85 m ahead.
- **HUD:** "Hold mouse · Excavate E · Transfer F · Get out".

## Part E. (4) Loaner wheelbarrow (`shared/hauling.mjs`)
**State:** `room.carts[] = {id, x, z, yaw, vx, vz, cargo, operator, brake, tipped, wobble, roll, wheel, steadier}`. One is spawned at (-18, 58) with brake on (line 11). `room.spills[]` holds the piles. Per player: `p.cart`, `p.tumble {until, vx, vz}`, `p.aid`. Server-simulated.

**Constants:** `CART_CAPACITY = 180`, `SAFE_LOAD = 72` (line 6).

**Controls**
- **Q** takes or releases the handles (`cart`). Taking them puts you 1.55 m behind the cart and releases the brake.
- **F** toggles the brake (`cartBrake`).
- **G** dumps or rights it (`cartTip`); the cart must be slower than 0.7 m/s.
- **E** loads your bucket into it (`loadCart`, within 3.8 m).
- **X** retrieves from the cart or a pile (`retrieve`, into your bucket of 24 or 64 kg).
- **H** steadies a friend's cart, or helps a fallen player up.
- W/S push, mouse look steers, Space brakes.

**Physics** (`tickHauling`, lines 81-137)
- Steering: `yaw += clamp(angleDiff, ±1.8·dt)`, quartered while braking.
- Drive speed: `(sprint ? 5.5 : 3)/(1 + max(0, load-1)·0.3)`, where load = mass/72.
- Velocity approaches the target at a gain of 13 (braking), 3.5 (pushed) or 0.5 (free).
- Unbraked, the slope pushes it: `v -= gradient·6·dt`. Braked, it decays at `exp(-10·dt)`.
- A move is rejected if `canWalk` fails, or the height change exceeds 0.7.
- Wobble: `unstable = max(0, load - 0.6)·(lateral·0.14 + |gradient|·speed·0.7)`, and `wobble += (unstable·(helpers ? 0.2 : 1) - (brake ? 2 : 0.32))·dt`.
- At wobble ≥ 1 it spills: 85% of the load becomes a pile 1.2 m ahead (merging within 2.5 m), the operator tumbles for 12 s, and getting up needs 2.2 aid (H from a helper at ×1.7, or holding Space).
- A runaway cart caught by an H helper below 0.35 m/s latches its brake.
- At speeds over 2.7 m/s it knocks down players within 0.85 m.

**Model:** `cartModel` in `scene.mjs:66-82` (tray, fill, wheel, hands). **Tests:** `tests/hauling.test.mjs` (6 tests) and `automation.test.mjs:14`.

## Part F. (5) Washers (`rules.json` catalog; `simulation.mjs:144-163`, `:253-258`; `automation.mjs`)

| Washer | Price | Requires | Capacity (kg) | Rate (kg/s) | Recovery | Water reach (m) |
|---|---|---|---|---|---|---|
| Rocker | $320 | — | 96 | 3.5 | 0.90 | 20 |
| Sluice | $1,100 | rocker | 320 | 7 | 0.94 | 17 |
| Wash plant | $10,500 | truck | 6000 | 32 | 0.97 | 32 (placement clearance 6.5 m) |
| Feeder belt | $650 | rocker | 180 | intake 12, output 6 | — | 1000 |
| Treadle motor (rockerdrive) | $180 | rocker | — | — | — | — |

- **State:** `room.machines[] = {id, type, x, z, yaw, cargo, goldMg, processed, running}`. Rockers add `powered`. The feeder adds `strain`, `jammed`, `jamReason`, `clearProgress`, `launchClock` and `helper`.
- **Placing:** buy the kit, then B to deploy within 10 m. The spot must be within the water reach of the creek, at height ≥ 0.65, outside town, and at least 4 m from other machines (2.8 m for feeders). G packs an empty washer.
- **Washing** (tick, line 256): a machine runs when it holds cargo, except an unpowered rocker, which needs a player within 5 m holding wash (left mouse or Space) with `input.operate = id`. Each tick it takes `rate·dt` kg and adds `goldMg·recovery` to the machine's gold. E with an empty container collects the gold.
- **Feeder** (`automation.mjs:16-43`):
  - Pulls loose piles within 1.5 m of its inlet at 12 kg/s.
  - Every 0.5 s it drops a 3 kg clod from its outlet, 4.4 m forward and 2.65 m up.
  - Strain builds while the hopper holds over 120 kg or the outlet is backed up (receiver free space under 3 kg, or a pile of 24 kg or more at the outlet). At 5 s of strain it jams.
  - H within 2.6 m for 2 s clears the jam and throws up to 12 kg in 3 clods at the helper.
- **Treadle motor** (`fitRockerDrive`, line 7): fitted to an unpowered rocker within 2.8 m of the aim point; sets `powered = true`.
- **Models:** procedural `machineModel` in `scene.mjs:89-117` (cradle, trough, drum, belt cleats, flywheel).
- **Tests:** `automation.test.mjs`, `automation-host.test.mjs`, `simulation.test.mjs:40-49`.

## Part G. (6) Other operable things
Mine carts, the cage hoist and the steam hoist (`shared/mine.mjs`), and the hand shovel and pick gesture (`soil.mjs`, `tools.mjs`) are operable but are not vehicles. The console can spawn things (`spawn excavator|truck|hydraulic|wheelbarrow|...`, `console.mjs:45`).

## Part H. Asset list
GF has no vehicle or machine model files at all; everything is procedural.
- `public/vehicle-model.mjs`: 9,555 bytes.
- `public/model-parts.mjs`: 65 lines.
- `public/scene.mjs`: `cartModel`, `machineModel`, `spillModel`.
- The only `.gltf`/`.bin` files are nature props in `public/assets/nature/`: Pine_1/3/5, Bush, Grass, Rock (2-345 KB).

Articulation exists only as named code groups (`upper`, `armRig.{boom, stick, bucket}`, `bed`, `boom`/`jet`, `wheels`, `fill`), not as nodes in a file.

In CGL, the related existing models in `public/models/` are:

| File | Size |
|---|---|
| `MrSirTruck.glb` (the jeep) | 141,624 B |
| `WaterTruck.glb` | 237,632 B |
| `LooseSand.glb` | 64,792 B |
| `Dynamite.glb` | 60,500 B |
| `HopperExt2.glb` / `HopperExt3.glb` | 30,432 / 77,372 B |
| `HopperSand1.glb` / `2` / `3` | 11,984 / 18,668 / 27,668 B |

There is no excavator or dump-truck model yet.

## Part I. Target codebase facts (CGL)

### I.1 The jeep (`public/js/87-truck.js`)
- **Body:** `TRUCK_L = 4.0`, `W = 1.8`, axles at local z +1.46 and -0.88, track 0.70 (line 20).
- **Coordinates:** `truckAt(lx, lz)` gives `x = T.x + lx·cos h + lz·sin h` and `z = T.z - lx·sin h + lz·cos h`. Local +Z is forward, so heading `h` faces (sin h, cos h). GF's yaw faces (-sin, -cos), so **CGL h = GF yaw + π**.
- **Seats** (`TRUCK_SEATS`, lines 25-29): drive, shotgun, tail0, tail1, each with an `at` / `door` / `out` position, a height `y`, `face`, `clip` and a `cab` flag. You get in with F within 1.7 m of a door (`truckSpot`, line 62).
- **State** (line 32): `TRUCK` = x, z, h, y, q (quaternion), velocity, angular velocity `w`, steer, `air`, `flipped`, `flipT`, `bog`, `seats`, `on`, `tgt`, `wreck`, and so on.
- **Physics** (`truckPhys`, lines 136-219): a rigid body run on **one client**, the owner. The owner is the driver, or with nobody driving, the lowest connected id (`truckOwner`, line 123).
  - 8 sub-steps per frame, gravity 16, per-wheel springs (9 rad/s, damping 0.9), tyre grip 1.3, body contact points.
  - Holes grab wheels (`BOG` 0.55, `STUCK` 1.1).
  - Twisters, tumbleweeds and boulders affect it. Hits against colliders are handled.
  - It can flip; F rights it, taking 1.3 s.
  - Tunables (`11-tune.js:51-62`): `veh.speed` 14, `veh.accel` 6, `veh.steer` 0.7, `veh.mass` 1800, `veh.hitSpeed` 4, `veh.hitDmg` 5, `veh.push` 0.6.
- **Networking:**
  - The owner sends `{t:'truck', op:'pos', x, z, h, v, y, qx, qy, qz, qw, vx, vz}` every 1/12 s while moving, plus one final message when it stops (`truckSend`, line 220).
  - The server checks the sender is the owner and that it is at least 1 s since parking, clamps the values, and rebroadcasts `{t:'truck', pos:[11 values]}` (`server.js:871-878`).
  - Other ops: `in {seat}` (6 m distance check, seat free), `out`, `flip`, `push`, `wreck`, `respawn` (host only) (`server.js:852-881`).
  - Seat and parking state: `truckMsg` sends `{t:'truck', st:{x, z, h, seats, on, park, wreck}}` (`server.js:195`).
  - Remote clients ease toward `tgt` at `k = dt·8` (`87-truck.js:316-320`).
- **Persistence:** the server keeps `TRUCK` in memory only; it is not in world.json.
- **Gating:** `truckOn` requires the `veh.drivable` flag or `world.camp.jeepKeys`, and being on the lake map (`server.js:192`).
- **Server-side effects:** `truckRams` knocks javelinas aside above 4 m/s (line 199). The cab is out of creatures' reach (line 1462).
- **Camera:** in first person (the default `FP = true`) the camera rides the seated body through the normal FP branch. In third person, `truckCamera` orbits 9 m out and looks at `T.y + 1.4` (`87-truck.js:302`, `70-player.js:129`).
- **Hooks:** `updatePlayer` → `truckPlayer` (`70-player.js:39`, `:50`); `nearSpot` checks `truckSpot`/`jeepSpot` first (`45-state.js:183-186`); `90-loop.js:52` calls `updateTruck(dt)`; remote seats via `truckRemoteSeat` in 65-net.
- **Generalising:** everything is a single `TRUCK` singleton and one `truck` message type. A second vehicle needs either a parallel module (`EXC` plus an `exc` message) or a refactor to `VEH[id]` with `{t:'veh', id, ...}`. The parallel module is the smaller change.

### I.2 Holes and terrain
- **Representation:** `{x, z, d, r, mx, mz, ...}`. Radius defaults to `HOLE_R = 1.25` (`10-core.js:19`). `mx, mz` is the spoil mound centre, offset by `r + 1.0` in a hashed direction, with mound radius `MR = 1.15` (`15-terrain.js:8-11`).
- **Indexing:** by 4 m `CELL` buckets (`grid`).
- **Ground shape** (`surfaceAt`, `15-terrain.js:16-24`): holes do **not** add together. At each point the deepest bowl wins. The bowl is flat to `0.72r`, then a smoothstep up to the rim. Mounds add `min(d, 1.5)·0.3`.
  - So a big pit has to be a **pattern of overlapping 1.25 m holes**, spaced about 1-1.2 m apart.
  - The 40 nearest holes get liner meshes; holes with `r > 1.875` are skipped by the liners (`46-holes.js:16`, `:136`).
- **Depth limits:** digging goes to 0.45 m by hand, `FIVE_FT = 1.5` with the shovel, `EIGHT_FT = 2.6` with the long shovel (`45-state.js:56`). The server clamps `d` to [0, 2.6]. The liner backstop plane sits at -EIGHT_FT - 0.8.
- **`scoop()`** (`45-state.js:84-123`): finds a hole within 1 m of you or 1.4 m of a point 1.1 m ahead, otherwise creates one at `r1` coordinates.
  - Step depth: 0.06 by hand, 0.088 shovel, 0.15 spade, multiplied by `dig.depth`.
  - `fillBucket(Δd, SIM.payMult(x, z, d))`: Δd/1.5 metres of depth equals one "hole of sand".
  - Sends `{t:'dig', x, z, d}`.
- **Server `dig`** (`server.js:696-707`):
  - `DIG_RATE = 8` per 1000 ms per connection (line 105).
  - `MAX_DIG_DIST = 6` m from the last reported presence position `c.x, c.z` (line 102, updated at line 672).
  - The camp no-dig strip `CAMP_NODIG = 4` around x[-40,30] z[27,56].
  - `MAX_HOLES = 40000` (line 20).
  - Depth only ever increases. Holes are keyed `"x|z"` at 0.1 m and saved in `world.holes`.
  - Broadcast as `{t:'dig', id, x, z, d}` (excluding the sender). On the client `applyDig` merges into an existing hole within 0.06 m (`65-net.js:45`).
- **Dynamite** (`server.js:407-418`, `88-dynamite.js`):
  - The crater is 5 holes: depth 1.3 at the centre and 0.9 at ±0.9 m on each axis, broadcast as `dig` with `id:0`. It bypasses DIG_RATE and MAX_DIG_DIST.
  - Mound: `world.piles[id] = {id, x, z, sand: dyn.sand (8 holes), rich: inVein}`, at most 20 piles, broadcast as `dynBoom` and `pile`.
  - Walking within 1.9 m of a pile pours `dyn.scoop = 2` holes/s into your bucket. That goes through `fillBucket(v·FIVE_FT)` with **no pay multiplier**, so piles carry only a vein flag.
  - The client reports removals as `pileTake {id, v ≤ 2}` every 0.25 s. The server does no distance or rate check on it.
  - The `LooseSand.glb` mound is scaled by `sand/8`.

### I.3 Sand and pay
- **`sandMix(k, add, mult)`** (`48-paydirt.js:22`) keeps a volume-weighted richness in `S[k+'Rich']`.
  - `sandRich(k)` returns that richness, defaulting to 1; `sandReset(k)` sets it back to 1.
  - Containers: bucket, hopper and `jeepSand`.
- **`payAssay`** (line 32) picks the grade with `SIM.gradeOf` and records map dots.
- **`sim.js`:**
  - `PAY` (line 61): barren 0.5, rich 3.4, grade cuts [0.6, 1.0, 1.7, 2.6].
  - `richAt(x, z)` (line 66).
  - `payDepth = 0.7 + 0.3·clamp(d/1.5) + 0.5·clamp((d - 1.5)/1.1)`.
  - `payMult = (0.5 + 2.9·r^1.3)·payDepth` (line 74).
  - `siftGold(holes, rnd, perHole = 4, mult)`: luck is lognormal, clamped 0.45-2.2; a 1-in-16 nugget multiplies by 2-4 (line 40).
  - `GOLD.SIFTER` is at (10.6, 39.2).
- **Hopper** (`86-hopper.js:13`): tiers hold 20 / 50 / 120 holes and sift one hole per 8 / 4 / 1.5 s. It is per player (`S.hopper`, `S.hopperRich`). `dumpHopper` (line 24) is triggered by F at the sifter.
- **Jeep tub** (`88-jeephaul.js`): `JEEP_HOLES = 30`, unload radius 18 m from the sifter, tail at local (0, -2.35), reach 2.3 m.
  - `jeepLoad` mixes richness in; `jeepUnload` fills the hopper first, then sifts the rest.
  - It is **client-side per player** (`S.jeepSand`, saved in `60-title.js:8`). The server never sees it.
  - The tub mound mesh is parented to `TRUCK.root` (line 44).
- **Camp upgrades** (`84-camp.js`): `CAMP` is mirrored from `world.camp`.
  - `goldScale()` = 1.1 if the scale is owned, times washer recovery: 0.75 base, 0.88 rocker, 1.0 sluice, 1.18 wash plant (line 17).
  - `campBuy` goes through `walletSpend`, then `{t:'campBuy', id, cost, rid}`.
  - SHOP entries with `camp:true` and the `campNeeds` chain are at `50-tents.js:70-78`. For example `jeepKeys` costs 1500; washers cost 600 / 2200 / 6500.
  - **The server whitelist** (`server.js:1000`) is `['goldScale', 'pipeTee', 'pipePump', 'pipeSteel', 'sodaMachine', 'washRocker', 'washSluice', 'washPlant', 'jeepKeys']`. New ids must be added there.

### I.4 Input and loop hooks
- `55-input.js`:
  - Left mouse sets `digHeld` (line 32). E is hold-to-dig (line 89).
  - F calls `use()`. Y throws dynamite. V switches view. C crouches.
  - Mouse look writes `P.yaw` / `P.pitch` (line 41).
  - There is no wheel handler outside spectator mode (line 130).
- `70-player.js`: `updatePlayer` early-outs at line 50; `updateCamera` branches at line 129; digging is `digHeld && ...` at line 61.
- `nearSpot()`: `45-state.js:181`, priority order at lines 182-186.
- `90-loop.js` `frame()`: `updatePlayer` → `updateCamera` (line 50), then the update list including `updateTruck` (line 52) and `updateJeepHaul` (line 54).

## Part J. My recommended minimal design (not existing code)

**1. State and authority.** Model the excavator and dump truck on the jeep: the client owns the physics, the server validates. Make them two new singletons, `EXC` and `DUMP`, in a new `87-excavator.js`, with messages `{t:'exc', op:...}` and `{t:'dump', op:...}` copying `truck`'s `in/out/pos`.
- Drive with GF's simple kinematic model at first: 3.2 and 10 m/s, 0.85 rad/s, slowed by load. Remember `h = yaw + π`.
- The truck could reuse `truckPhys` later.
- Send `arm {boom, stick, slew, curl}` targets with `pos`. Run GF's `tickArm` spring on every client for smooth remote motion. The pose function ports directly.
- Gate both vehicles behind camp upgrades `excavator` and `dumpTruck` (`camp:true`, with `campNeeds` mirroring GF's chain). Add those ids to the `campBuy` whitelist.

**2. A scoop on the holes system.** Add a dedicated server message, `{t:'excScoop', x, z}`. Do not reuse `dig`, because its 8/s rate and 6 m distance from the player cannot cover an arm reaching about 7.5 m from the hull.
- **Server checks:**
  - the sender is in the `drive` seat;
  - the tip is within about 9 m of `EXC.x, z`;
  - one scoop per `exc.digSeconds` (2.3 s);
  - outside camp and its no-dig strip;
  - the bucket has room.
- **Server writes** a pattern of `HOLE_R` holes, like the dynamite crater: a centre hole plus 4-6 holes about 1.0 m around it, centre +0.45 m and ring +0.2 m. That fits GF's 0.48 / 0.16 per scoop and stays within the 1.25 m bowl rule. It broadcasts them as normal `dig` messages.
- **Limits to keep or raise:**
  - Keep the 2.6 m depth clamp for a first version. GF's 5.8 m would mean raising the clamp, `applyDig`'s `EIGHT_FT` clamp and the liner backstop plane.
  - `MAX_HOLES` (40000) is enough. Each scoop costs at most 5-7 keys, and repeat scoops reuse keys.
- **Bucket volume:** about 180 kg in GF. Express it in holes of sand: Δdepth over the pattern / 1.5, about 0.5-1 hole per scoop. Bucket capacity is 4 scoops.

**3. Richness travels with the load.** The server should keep `EXC.load = {holes, rich}` and `DUMP.load = {holes, rich}`.
- At each scoop: `rich` is mixed by volume with `SIM.payMult(x, z, newDepth)`, the same formula as `sandMix`.
- **Dumping:**
  - (a) Truck bed within about 2 m of the tip: the server moves the load across, mixed by volume.
  - (b) Ground: a `world.piles` entry with a **new numeric `rich` value**. Today piles carry only a vein boolean, and `updateDynamite`'s `fillBucket` would need to pass it through as the multiplier.
  - (c) Hopper or sifter: the truck parked within `JEEP_UNLOAD_R` unloads like `jeepUnload`, filling hoppers and sifting the remainder.
- Because the truck is shared and server-held, unloading should be a server op that awards the load to the unloader. Sift on the client like `jeepUnload`, or extend the server; the jeep's tub stays per-player as it is.
- Skip GF's physical clods for now; that is CGL Phase 6. A flick dump can simply land as a pile `power·k` metres ahead.

**4. Camera and input hooks.**
- In `updateCamera`, add an `S.inExc` branch with GF's cab-eye camera: pitch toward the tip plus look pitch, clamped to [-1.2, 0.4].
- In `55-input.js`, when `S.inExc`: route mouse movement to the arm instead of `P.yaw` (slew 0.005 and boom 0.004 per pixel, curl with C), add a `wheel` handler (stick ±0.12), and make right-drag look.
- In `70-player.js:61`, when `S.inExc`: replace `digHeld` with the plant / pull-36 / release gesture.
- Add `excSpot()` and `dumpSpot()` before `truckSpot` in `nearSpot`, and call `updateExcavator(dt)` from `90-loop.js:52`.

**5. Art.** Build the models with Blender `.glb` exports, with named nodes `Upper`, `Boom`, `Stick`, `Bucket`, `BucketFill`, `Rollers` for the excavator, and `Bed`, `BedFill`, `Wheel*` for the truck. Put the pivots at GF's offsets: boom at (-0.85, 2.65, -0.8); stick at -3.6 and bucket at -3.1 along the arm; bed pivot at (0, 1.45, 3.55). Flip -Z forward to +Z to match `truckAt`. GF's `vehicle-model.mjs` gives the proportions.

**6. Tests.** Add a `tests/` server check covering seat exclusivity, the scoop rate and reach limits, the camp no-dig strip, the hole pattern stopping at 2.6 m, and load and richness being conserved through bucket, truck and pile.