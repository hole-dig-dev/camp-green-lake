# Gold Fever

### Western art pass (0.17)

Textured authored pines replace cone trees, with branched trunks, three models and lower detail for distant trees. Sage bushes, dry grass and shaped rocks add ground detail. A local HDR sky provides cloud scenery and reflections; lower ambient brightness and a moving, tighter sun shadow region give characters and machinery depth. Background hills have actual sloped geometry. Vehicle paint now receives wear textures; welded arm plates, service panels, handles and bolts replace smooth toy-like parts. Miners have longer legs, smaller heads and added clothing details. Curved bucket staves, a cupped shovel blade and a metal pan replace the earlier rough hand props.

Free CC0 nature models from Quaternius and an HDR sky from Poly Haven are included locally. No engine or editor install is needed. See ASSETS.md for sources, license and checksums. These changes affect presentation; existing room saves and demanding controls are preserved. This remains a stylized prototype; subjective art quality and hardware performance need player feedback.

A playable first-person cooperative gold-rush prototype. Start with a shovel, bucket and pan. Learn where the gold-bearing gravel lies, sell gold into a crew treasury, and progress through washing equipment to excavators, dump trucks and a ridiculous hydraulic rig.

### Sculpted miners and vehicles (0.16)

Players, Bill, Mabel and canyon guards now have rounded bodies, expressive faces, curved cowboy hats, suspenders, scarves and boots. Hands and forearms are smoother. The dump truck has rounded panels, proper tires and tread, mirrors, grille, exhaust and a framed cab with a seat and steering wheel. The excavator has track rollers, shaped arms, hoses, piston, lights and an open curved bucket. The hydraulic rig has a cylindrical tank and a new cab. Wheels and rollers turn with actual travel; bucket loading, tipping and arm articulation remain active. Wheelbarrow panels have softened edges.

These are original locally generated meshes: no model download, paid tool or new installation. Refresh the game tab to load them. Normal controls, saved mines and progression continue. Trees, buildings and some mine fixtures still use the earlier simpler models.

### Material textures (0.15)

Ground now uses detailed gravel and soil, canyon/mine walls use cracked sandstone with softer geological layers, and timber, buckets, tools and machinery show wood grain and worn metal. Trees and mine supports have bark and log-end rings; clothing has a subtle woven surface. Textures stay anchored to the world as you excavate, instead of stretching down cliffs or starting over at tunnel chunk boundaries. Wet creek edges darken naturally. Surface lighting is smooth; the actual digging/collision geometry remains the same.

All maps are included locally: **12 free 1K JPEGs, about 4.8 MiB**, from Poly Haven's official CC0 library. No graphics software installation is required. See **ASSETS.md** and the source/checksum manifest in **public/assets/materials/manifest.json**. Refresh an existing game tab to load this version. Existing money, equipment and mines are preserved.

### Buried finds and the Motherlode (0.14)

Coins, pocket watches, fancy boots and silver horseshoes are buried in real dirt and rock. Digging exposes them; **E** secures a nearby find. Sell it with **E at Bill’s Assay** to finance upgrades. Your separate find satchel holds three slots. **G while holding the divining rod** drops your last find for a friend. Finds and their ownership save with the room.

Buy the **Crooked divining rod ($180 solo)** at Mabel’s and equip it with **5**. Walk and sweep your view: a stronger rattle and gauge reading means you face a nearby find. Close signals indicate whether to dig down or search a wall. It is a fictional frontier contraption with a 24m range. Valuables can also be uncovered without it. Normal shovel/pick controls remain.

**One Motherlode nugget** lies 4–7m beneath the canyon floor. **M** gives a broad location rumor and tracks the crew’s finds. The nugget fills all three satchel slots and slows walking/sprinting by 30%. Sell or drop smaller finds before collecting it; use a ramp or purchased rope to get out alone, and brace actual tunnel roofs. Returning it to Bill pays **$15,000 once** and completes the shared hunt. Mining continues afterward. Existing maps, money and equipment are preserved. Initial values still need long-session balancing.

### Canyon guards (0.13)

Four grumpy miners defend Crooked Gorge: Grumble Gus, Old Man Ore, Boot Scoot Bill and Bridge Bert. Big brown hats, white beards, red shirts, blue overalls and yellow scarves match their ridiculous attitude. They patrol, shout at visible trespassers, chase, then wind up for a fully clothed twerk attack. A close hit knocks you back and spills a small amount of carried bucket dirt. Its gold stays in the recoverable pile.

**Sprint with Shift during the one-second warning.** They stop to dance and recover, giving a solo miner time to escape; even a full starter bucket can outrun them. A brief grace period prevents consecutive hits from a crowd. Rock blocks their sight and attacks. Friends see the same guards and animations; four guards serve the room, regardless of whether one or eight players join. Their canyon patrol positions persist, and a host restart cancels stale attacks.

Try the bridge or descend into the canyon normally. For a quick encounter, press **~**, enter `tp canyonbridge`, then close the console. Keep flight off to be chased. The existing map and progression are preserved.

## Play on this computer

1. Double-click **Launch.cmd**. It starts the host and opens the game at **http://localhost:4317**.
2. Enter your prospector name and expected crew size (1–8). Leave the room code empty to create a new private crew, or enter an existing code to resume a saved world. A world creator can increase capacity in the guide. Disconnecting does not change prices.
3. Choose **Gold Rush** for difficult progression, or **Machine Playground** to try the late equipment immediately in a separate world.
4. Entering the goldfield requests mouse capture. If the cursor stays visible, click **Capture mouse**. In browser panels that reject capture, hold the **right mouse button and drag** to look; use the left button to dig. Press **Tab** for the in-game guide.

The host needs Node.js 22 or newer. Node is already available on the computer where this prototype was built. Chrome or Edge on a desktop is recommended. Friends only need a browser. All 3D assets and dependencies are included locally; the game uses no paid APIs.

## Play with your friend over the Internet

1. Double-click **Share with Friend.cmd** on the host computer. It starts the host if needed, then prints and opens an HTTPS Internet address.
2. Open that address yourself and enter the goldfield.
3. Use **Copy invite** in the upper left. Send that invite to your friend. It includes your room code.
4. Your friend opens the invite, enters their own name, and joins the same crew.

Keep the host computer awake. Both the game server and tunnel must remain running. The link changes when a new tunnel is created; your saved room and its code remain the same. **Stop Hosting.cmd** saves the worlds and closes the server and tunnel.

The included Cloudflare utility creates temporary development tunnels without requiring an account. Temporary tunnels have no uptime guarantee. [Cloudflare Quick Tunnels documentation](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

For the same Wi-Fi, use **Copy invite** before starting a tunnel to see the local network address. The host firewall may need to allow Node.js on the private network. Internet sharing through the tunnel does not require router port forwarding.

## Your first gold

Walk east from town toward the creek. Press **T** to place your wooden bucket. Aim down at dirt, **hold left mouse and drag upward** to lift a scoop onto the shovel. Aim into the bucket and release gently to toss it in; a fast flick throws farther. Dirt that misses becomes a recoverable pile. **T** picks up the bucket; **E/X** recovers spilled dirt. Your starting bucket holds four 6 kg scoops. On the creek bank, press **R** to put up to 8 kg in your pan. Hold mouse or Space until the instruction changes to settling, then release it. Repeat to wash the rest of your bucket.

You can also keep the bucket in your hand: after lifting a scoop, **hold C**, **release left mouse** to lob it upward, and **move the mouse** to slide the bucket underneath. Keep C held until the dirt lands. A missed catch lob bounces back into your face and obscures your view with brown mud for **three seconds**. Friends can see the raised bucket and your muddy face. Spilled paydirt remains recoverable. A full bucket cannot catch more dirt.

The shovel follows mouse movement and its load remains on the blade until thrown. Other players see the held dirt, flying clods, buckets and terrain changes. See **REFERENCE-AND-DIGGING.md** for the original Needle footage review, automation roadmap, new controls and current physics limits.

**M** opens your field book. Each washed sample records its recovered gold and average source location. Compare samples, and dig deeper where results look promising. The pan does not reveal the hidden deposit directly. Samples from several mixed digging spots give an averaged reading.

Return to **Bill's Assay**, the larger town building, and press **E** to sell the gold in your pouch. Visit **Mabel's Hardware** next door and press **E** to shop. Earnings belong to the whole crew; dirt and recovered gold belong to the player carrying them until sold or transferred.

## Build a real mine

**Crooked Hat Mine** is northwest of town, marked on the field map (**M**). Walk to its old shaft, use the corner ladder (**Ctrl down / Space up**), and excavate your own passages with the same shovel gesture. Walls, ceilings and floors really disappear; tunnels remain saved and shared. Buy **tracks, ore carts, a cage hoist, shaft extensions and a steam hoist** at Mabel’s. Everything works with one player. See [MINE-GUIDE.md](MINE-GUIDE.md) for building and hauling instructions.

To try it quickly, open **~**, run `give all` and `tp mine`, close ~, then use **B** to build. `tp minebottom` visits your deepest landing. These commands alter your saved world; use a new room for experiments.

## Crooked Gorge (v0.12)

The northern goldfield now has a **208m-long canyon with 38m cliffs**, a west descent and a 44m plank bridge. The overall map remains 224 × 224m. Head northwest from town, follow the gorge signs, and use **M** to find the descent. Walking in and out works solo. The bridge has no invisible safety rails; walking off drops you into the gorge.

Its walls and floor support persistent rounded tunnels, diagonal ramps and shafts, down to **Y -64m**. **4** equips your best owned pick; the usual plant / pull / toss gesture excavates the rock. Supports are needed under actual tunnel roofs, including tunnels above the old mine's surface height. Open-air canyon cuts are safe from cave-ins. Bring ore back to the creek to wash it. Existing rails and carts work on cleared, level canyon floors; the cage hoist still belongs to the old shaft.

Hidden console: **~**, then **tp canyon**, **tp canyonfloor**, or **tp canyonbridge** for a quick look. Map resets are host maintenance operations, backed up first; they retain treasury, upgrades, equipment and stored ore.

## Controls

| Control | Action |
| --- | --- |
| WASD / arrow keys | Walk; in a vehicle, W/S drives and A/D steers |
| Mouse | Look; hold left on dirt, drag upward to lift, release to toss; hold beside a loaded rocker to operate |
| Right mouse + drag | Look when your browser cannot capture the pointer |
| Shift / Space | Sprint / jump; Space washes while panning |
| R | Start or cancel panning near the creek |
| 1 / 2 / 3 / 4 | Select shovel / pan / wood axe / best purchased mine pick |
| C (hold) + mouse | Raise and position the carried bucket; release the loaded shovel to lob and catch dirt midair |
| T | Place or pick up your wooden bucket |
| E | Shop, sell, transfer gravel, or collect washer gold |
| F | Enter or exit a nearby vehicle; toggle a wheelbarrow's parking brake |
| Q | Take or release wheelbarrow or mine-cart handles |
| X | Recover spilled gravel, or retrieve gravel from a nearby wheelbarrow |
| H (hold) | Steady a nearby wheelbarrow or help a fallen friend |
| B | Choose and place a washing or mine equipment kit |
| G | Dump a mine cart or wheelbarrow; right a barrow; pack an empty washer |
| Space / Ctrl at ladder | Climb up / down; stop to hold your position |
| L / E at shaft | Call the cage / board or exit; a held mine cart latches automatically |
| I / K at cage or landing | Hold to crank up / down; with steam, tap to travel to the next landing |
| M / Tab | Field map / guide |
| Esc | Release mouse, close menu, cancel placement |
| Enter / V | Crew chat / yeehaw |
| O | Toggle fullscreen |

## Equipment and teamwork

### Hidden console

Press **~** (or backtick) in the goldfield for money, teleport, flight, recovery and equipment commands. Start with `help`, `money 10000`, `tp creek`, `give all`, or `fly on`. Esc/~ closes it; Up/Down recalls commands and Tab completes them. See **CONSOLE.md** for the full command list. Money/equipment changes are saved and cash is shared with the crew.

Base solo prices: hand upgrades start at $35; rocker $320; rocker motor $180; feeder belt $650; sluice $1,100; excavator $4,800; truck $7,200; wash plant $10,500; Widowmaker $35,000. Prices scale with the world's configured crew size: base × (1 + 0.65 × (crew size − 1)). The shop shows the actual cost. This is provisional tuning; the longer campaign target is not yet balanced. Gold prices and deposit densities are fictional balancing values.

### Borrow the wheelbarrow

The camp loaner holds 180 kg. Up to 72 kg is the recommended load; heavier loads can tip during fast turns or on slopes. Walk up and press **Q** to take the handles. W/S pushes, mouse look steers, and holding **Space** brakes. **F** toggles the parking brake. Park before releasing with Q, then dig into your bucket and use **E** beside the cart to load it. Push beside a washer or truck and E transfers the load.

A friend holding **H** within reach steadies the load. Hold H beside an unheld runaway barrow to slow it and latch its brake once stopped. Alone, take smaller loads, brake before turning, and park between tasks. Tipping leaves a gravel pile with its contained gold. Hold Space to get yourself up, or have a nearby friend hold H. Use G to right the stopped barrow and X to recover gravel; X prioritizes nearby spills. An idle fallen miner gets up after 12 seconds. These tumbles are recoverable accidents; the planned survival/death system is not implemented.

### Washing and industrial equipment

- **Rocker:** buy a kit, place it on the creek bank with B, load a bucket with E, then hold mouse nearby to rock it. Use E with an empty bucket to collect its gold.
- **Rocker motor:** buy after the rocker. Select it with B and aim at ground beside an unpowered rocker to fit it. That rocker washes unattended at its original rate. Packing it returns both kits.
- **Feeder belt:** buy after the rocker; B places its hopper where you aim, with an outlet 4.4m forward. The second ring marks the drop point (green when aligned with a reachable washer). Dump a parked barrow’s load beside the hopper, shovel dirt there, or E load the hopper. Loose piles within 1.5m feed in automatically at 12 kg/s; physical output drops at 6 kg/s. Aim into a rocker/sluice. Hoppers above 120kg or backed-up outlets strain for five seconds and jam. Hold H within 2.6m of the hopper for two seconds to clear it. The discharge spits up to 12kg of recoverable paydirt; keep your face clear. Clear output piles or downstream capacity before restarting a backed-up chute. A normal ground-level belt cannot reach the wash plant’s high inlet.
- **Sluice:** place close to the creek. Load with E. It washes automatically while you scout or dig.
- **Excavator:** F enters; mouse swings/raises the boom, wheel folds the stick, C + mouse curls the bucket. Lower the teeth to dirt, hold left and pull up for a 180 kg scoop. Release keeps the load. With a load, hold left, swing and release to dump/fling; Shift + left pull adds another scoop. Aim over a truck bed or washer to catch the falling dirt. E still transfers to a nearby truck/washer. R centres the arm.
- **Dump truck:** your crewmate can load it from an excavator while you drive it. Haul the gravel to a washer and press E to tip your load.
- **Wash plant:** aim at a creek-bank spot 6.5–10 metres away when placing this large kit. Handles 6,000 kg and washes 32 kg each second. It holds the recovered gold until someone collects it.
- **Widowmaker:** scoops 650 kg in a burst. The crew still needs hauling and processing capacity.

If a bucket is full, process or transfer it. If a washer is full, allow it to work before loading more. Empty washers can be packed and moved. Vehicles have one driver at a time. Roles are informal: everyone can scout, dig, haul or run a washer.

## Saves, source and exports

Worlds save automatically every five seconds and when a player leaves. Original save files are in **data/worlds/ROOMCODE.json**. Back up that directory to preserve complete worlds and browser profile associations. Returning from the same browser profile at the same address restores that player's inventory and samples. Save your **personal prospector pass** from the in-game guide: when a tunnel link changes or you use another browser, open “Returning on a new sharing link?” on the join screen and paste that pass to restore your miner in the same room.

The guide has **Export world JSON** and **Export terrain OBJ**. JSON exports include equipment, economy, terrain heights, sample history, deposit shapes and sparse excavation edits. Browser credential keys are omitted. JSON includes the 3D mine’s sparse removed cells, levels, tracks and loaded carts. OBJ exports contain both surface terrain and the mine’s exposed walls, floors and ceilings, with its shaft left open.

The source is in this folder. See **ARCHITECTURE.md** for modules, the network protocol, balancing and Unreal migration. See **DESIGN.md** for the developed concept and expansion plan.

## Development

```powershell
npm install
npm start
npm test
```

Use a different port by setting `$env:PORT = '4318'` before `npm start`. The Windows convenience launchers use port 4317. Start a tunnel manually for another port with `tools/cloudflared.exe tunnel --url http://127.0.0.1:4318 --protocol http2 --no-autoupdate`.

This is a first playable prototype. Terrain supports surface pits and a real volumetric mine claim, 48 × 48 metres with 38 metres of rock depth. The extendable shaft reaches 36 metres. Vehicle movement is simplified, and rock clutter is decorative; trees can be chopped for wood. Long-session economy balance needs human playtesting. Automatic underground cart dispatch, ore crushers, fuel/maintenance and public matchmaking are expansion work.

### Smooth mines (0.7)

Excavation follows your aim without removing whole cubes: rounded galleries, diagonal descending ramps and straight-down shafts. Terrain collision uses the same continuous surface. Buy a $35 rope ladder, deploy it with B at your feet before digging a shaft, and use Space/Ctrl to climb/descend alone. Existing saves and mine carts/hoists remain supported. See MINE-GUIDE.md for the full loop.

### Timber supports and hand-tool progression (0.8–0.9)

**3** equips your free axe: chop trees, **E** collect six logs, **B** craft a support for four logs. Brace tunnels about every four metres. Unsupported roofs crack and shed dirt before a recoverable cave-in. Wood can be dropped for a friend with **G** while holding the axe.

Buy a **miner’s pick ($65) → pick-mattock ($210) → heavy tunnelling pick ($620)** at Mabel’s. **4** equips your best pick; use the same click, pull and toss interaction on mine rock. Upgrades really widen and lengthen the excavation, reduce the mouse pull and clear larger loads. **1** equips the shovel for surface dirt. Tools, felled trees, supports, tunnels and cave-ins save with the room. Prices listed are for a solo world. See MINE-GUIDE.md for timings, limits and solo recovery.


### Rustbucket arm controls (0.10)

The excavator has a jointed swing, boom, stick and hollow bucket, an extending piston and load-dependent wobble. Digging uses the bucket teeth’s position. **Mouse right/left swings, up/down raises/lowers; wheel up extends and down folds the stick; C + mouse up/down curls/opens the bucket. Hold right mouse to look around.** W/S and A/D still drive the tracks; F exits.

Lower the teeth until the ground marker turns green. **Hold left and pull up** to scoop 180 kg. Release retains it. **Hold left with a load, swing and release** to tip or fling it: a gentle release drops, a fast flick throws. **Shift + left pull** adds another scoop, up to 720 kg. Truck beds and washer openings catch descending dirt; misses remain recoverable. E retains the convenient transfer shortcut; R centres the arm. Friends see the actual joint motion, bucket load and flying parcels. This works in the Codex browser fallback too.


### Excavator stability (0.10.1)

Mouse and wheel control now share the normal input stream, preventing high polling rate mice from disconnecting the driver. The cab and arm use a common smoothed pose, and quick pulls wait for the required planting time. Reload an already-open game tab to use the updated client. E transfers to washers report success correctly.

### Physical feedback and mechanical upgrades (0.11)

The existing demanding mouse/tool controls remain. Planting produces a dirt scrape, pulling meets visible resistance, and successful digs recoil. Dirt landing in your held bucket rocks it; machine catches produce dust, a thud and a rattle. Motors and belts make nearby mechanical sounds; overloads/jams and rolling barrows have distinct rattles. Sounds attenuate with distance and pan left/right. Sound can be toggled in Tab.

The first new upgrades remove jobs: a fitted motor replaces hand-rocking, and the feeder replaces repeated small unloading trips between a dumped pile and a washer. You still need to arrange the equipment, deliver the dirt and handle overloads. All jobs can be done solo; extra players can dig, haul or clear a jam while others keep working. The price/rate/safe-load values are initial tuning. Autonomous excavation, long conveyor runs and mine-cart dispatch remain later work.
