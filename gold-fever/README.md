# Gold Fever

A playable first-person cooperative gold-rush prototype. Start with a shovel, bucket and pan. Learn where the gold-bearing gravel lies, sell gold into a crew treasury, and progress through washing equipment to excavators, dump trucks and a ridiculous hydraulic rig.

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

## Controls

| Control | Action |
| --- | --- |
| WASD / arrow keys | Walk; in a vehicle, W/S drives and A/D steers |
| Mouse | Look; hold left on dirt, drag upward to lift, release to toss; hold beside a loaded rocker to operate |
| Right mouse + drag | Look when your browser cannot capture the pointer |
| Shift / Space | Sprint / jump; Space washes while panning |
| R | Start or cancel panning near the creek |
| 1 / 2 | Select shovel / pan |
| C (hold) + mouse | Raise and position the carried bucket; release the loaded shovel to lob and catch dirt midair |
| T | Place or pick up your wooden bucket |
| E | Shop, sell, transfer gravel, or collect washer gold |
| F | Enter or exit a nearby vehicle; toggle a wheelbarrow's parking brake |
| Q | Take or release wheelbarrow handles |
| X | Recover spilled gravel, or retrieve gravel from a nearby wheelbarrow |
| H (hold) | Steady a nearby wheelbarrow or help a fallen friend |
| B | Choose and place a washing equipment kit |
| G | Dump or right a nearby wheelbarrow; pack an empty washer |
| M / Tab | Field map / guide |
| Esc | Release mouse, close menu, cancel placement |
| Enter / V | Crew chat / yeehaw |
| O | Toggle fullscreen |

## Equipment and teamwork

### Hidden console

Press **~** (or backtick) in the goldfield for money, teleport, flight, recovery and equipment commands. Start with `help`, `money 10000`, `tp creek`, `give all`, or `fly on`. Esc/~ closes it; Up/Down recalls commands and Tab completes them. See **CONSOLE.md** for the full command list. Money/equipment changes are saved and cash is shared with the crew.

Base solo prices: hand upgrades start at $35; rocker $320; sluice $1,100; excavator $4,800; truck $7,200; wash plant $10,500; Widowmaker $35,000. Prices scale with the world's configured crew size: base × (1 + 0.65 × (crew size − 1)). The shop shows the actual cost. This is provisional tuning; the longer campaign target is not yet balanced. Gold prices and deposit densities are fictional balancing values.

### Borrow the wheelbarrow

The camp loaner holds 180 kg. Up to 72 kg is the recommended load; heavier loads can tip during fast turns or on slopes. Walk up and press **Q** to take the handles. W/S pushes, mouse look steers, and holding **Space** brakes. **F** toggles the parking brake. Park before releasing with Q, then dig into your bucket and use **E** beside the cart to load it. Push beside a washer or truck and E transfers the load.

A friend holding **H** within reach steadies the load. Alone, take smaller loads, brake before turning, and park between tasks. Tipping leaves a gravel pile with its contained gold. Hold Space to get yourself up, or have a nearby friend hold H. Use G to right the stopped barrow and X to recover gravel; X prioritizes nearby spills. An idle fallen miner gets up after 12 seconds. These tumbles are recoverable accidents; the planned survival/death system is not implemented.

### Washing and industrial equipment

- **Rocker:** buy a kit, place it on the creek bank with B, load a bucket with E, then hold mouse nearby to rock it. Use E with an empty bucket to collect its gold.
- **Sluice:** place close to the creek. Load with E. It washes automatically while you scout or dig.
- **Excavator:** get in with F, drive to a claim, aim down and hold mouse to scoop up to 180 kg at a time. Pull within 13 metres of a truck or 12 metres of a washer; E transfers the load.
- **Dump truck:** your crewmate can load it from an excavator while you drive it. Haul the gravel to a washer and press E to tip your load.
- **Wash plant:** aim at a creek-bank spot 6.5–10 metres away when placing this large kit. Handles 6,000 kg and washes 32 kg each second. It holds the recovered gold until someone collects it.
- **Widowmaker:** scoops 650 kg in a burst. The crew still needs hauling and processing capacity.

If a bucket is full, process or transfer it. If a washer is full, allow it to work before loading more. Empty washers can be packed and moved. Vehicles have one driver at a time. Roles are informal: everyone can scout, dig, haul or run a washer.

## Saves, source and exports

Worlds save automatically every five seconds and when a player leaves. Original save files are in **data/worlds/ROOMCODE.json**. Back up that directory to preserve complete worlds and browser profile associations. Returning from the same browser profile at the same address restores that player's inventory and samples. Save your **personal prospector pass** from the in-game guide: when a tunnel link changes or you use another browser, open “Returning on a new sharing link?” on the join screen and paste that pass to restore your miner in the same room.

The guide has **Export world JSON** and **Export terrain OBJ**. JSON exports include equipment, economy, terrain heights, sample history, deposit shapes and sparse excavation edits. Browser credential keys are omitted. OBJ exports contain the excavated terrain as a standard mesh.

The source is in this folder. See **ARCHITECTURE.md** for modules, the network protocol, balancing and Unreal migration. See **DESIGN.md** for the developed concept and expansion plan.

## Development

```powershell
npm install
npm start
npm test
```

Use a different port by setting `$env:PORT = '4318'` before `npm start`. The Windows convenience launchers use port 4317. Start a tunnel manually for another port with `tools/cloudflared.exe tunnel --url http://127.0.0.1:4318 --protocol http2 --no-autoupdate`.

This is a first playable prototype. Terrain supports pits and trenches, vehicle movement is simplified, and tree/rock clutter is decorative. Long-session economy balance needs human playtesting. Future tunnels, overhangs, complex vehicle physics, fuel/maintenance, steam infrastructure and public matchmaking are expansion work.
