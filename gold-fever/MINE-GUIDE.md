# Make your own mine

Crooked Hat Mine is northwest of town, at **X -64, Z 30**. Press **M** for the field map. The old shaft and its first small landing are open. The surrounding rock is solid: every new branch must be excavated. A free belt lamp and permanent ladder let you start alone without buying a hoist.

## Excavate

1. Stand beside the ladder in the southwest corner of the opening. **Ctrl** climbs down; **Space** climbs up. Release the key to hold your position. Walk sideways off the ladder at a landing.
2. Aim at a nearby wall. **Hold left mouse**, **pull the mouse upward**, then release to throw the load. The excavation follows your aim with rounded walls and ceilings. Aim horizontally for a level gallery, diagonally downward for a ramp, or straight down for a shaft. Walk into the cleared space before continuing.
3. Keep the bucket in your hand and **hold C** to position it under the tossed dirt, or place it with **T** and aim a gentle throw into its mouth. Low ceilings can bounce dirt back. Misses and face splats remain recoverable with **X**.
4. Repeat to lengthen your tunnel. Aim at the sidewalls to widen it for rails. Floors and ceilings can also be excavated. For a personal shaft, buy a rope ladder, place it with B at your feet before digging, then stay beside it: Ctrl descends and Space climbs. Release to hold your position. The rope extends as you dig beneath it; the permanent ladder serves the central shaft.
5. Rock colour changes with quartz-bearing ground. Wash samples to measure their yield. Mining does not put spendable gold directly in your pouch: bring material to the creek or a washer, process it, then sell the recovered gold.

In the Codex browser panel, use **right mouse + drag** to look when pointer capture is unavailable. Left mouse still plants and pulls the shovel. C temporarily routes mouse movement to the bucket.

## Buy and build

Buy kits at **Mabel’s Hardware**, then press **B** to choose a kit and click a cleared floor. Esc cancels placement. Failed placement keeps the kit. Underground rail positions snap to a two-metre grid; clear a level passage roughly two metres wide. Follow the tracks already laid when placing the next section. The mine entrance also opens this guide with **E**.

| Equipment | Base solo price | Purpose |
| --- | --- | --- |
| Track bundle: 6 sections | $95 | Two-metre sections, joining into routes and corners |
| Mine cart | $180 | Holds 240 kg; place on a rail |
| Cage hoist | $450 | Carries one cart and up to eight miners in the old shaft |
| Shaft extension | $180 | Adds six metres of shaft, ladder, guides and a new landing |
| Rope ladder | $35 | Anchor at your feet before digging your own shaft; climb without a helper |
| Mine lantern | $18 | Light a cleared passage |
| Log mine support | 4 logs | Craft in B from chopped trees; braces nearby roof |
| Steam hoist engine | $1,400 | Upgrades an installed hoist to automatic travel between landings |

Prices scale with the configured crew size using the same formula as surface equipment. The shop shows the actual cost. Machine Playground and the hidden console can accelerate experimentation.

## Load and move a cart

- **E** beside a cart transfers bucket material into it. **X** takes material back into the bucket.
- **Q** takes the handles. Aim along the route; **W** pushes toward your aim and **S** pulls back. Aim down a joining branch to turn. A missing section stops the cart.
- **F** toggles the brake. **Q** releases and parks it. Only one player controls a cart at a time.
- **G** deliberately tips its contents into a recoverable pile at its current depth.

Install track at **X -68, Z 30** on each landing used by the hoist. The cage attaches to a held cart within five metres; this is a forgiving loading assist. A released cart lands at that coordinate. It remains recoverable even if the receiving rail has not yet been built.

## Haul to the surface alone

1. Install the cage hoist beside the shaft with B. Lay receiving track on the surface and lower landing.
2. Fill the cart, take its handles with Q, and push beside the shaft.
3. **L** calls the cage to your landing. Wait for it to stop. An unattended cage can return by itself.
4. **E** boards and latches the held cart into the cage.
5. **Hold I** to crank up, or **hold K** to crank down. The miner can operate from inside the cage. Release to stop; continue to a landing before exiting.
6. **E** exits at a landing and places the cart on the landing. **Q** parks/releases the handle; **X** retrieves material for processing. Multiple bucket trips can empty a full cart.
7. With the steam upgrade, **tap I/K** to travel automatically to the next landing. Co-op miners can dig, widen tunnels, lay track and haul in parallel; every step also works sequentially alone.

If the cart operator disconnects or the host stops mid-shaft, the miner returns to a safe landing. Its loaded cart remains in the cage. Call it with L, board, and exit to recover it. Reloading retains tunnels, mine equipment and material.

## Fast experimenting with ~

```text
give all
tp mine
tp minebottom
tp -70 30.5 -6
```

The coordinate order is **X Z Y**, including negative underground heights. `give minetrack` grants a six-section bundle; `give shaftkit` grants one extension. Use a fresh room for testing because grants, cuts and construction save normally.

## Bounds of this prototype

The overall valley is still **224 × 224 m**. The true volumetric claim is **48 × 48 m**, X -88 to -40, Z -12 to 36, with continuous rounded excavation down to Y -32: **38 m below its surface**. Shaft extensions reach **36 m depth** in six-metre steps. Your own tunnels and underground chambers can occupy the claim. Other parts of the valley still use surface terrain.

The shovel is a stylized excavation tool for both dirt and rock. Rails are simplified guides and the hoist has forgiving cart alignment. Physical dirt consists of conserved parcels, rather than a full rigid-body granular simulation. Support coverage and cave-ins are regional gameplay approximations, rather than a full geological stress simulation. Tree falling is animated, not rigid-body collision. Ventilation, water flooding, crushers, conveyors and automatic underground cart dispatch are future systems. The steam hoist and existing surface washers provide the current automation progression.

The world JSON export preserves the mine volume bounds, continuous cut shapes, legacy cuts, levels, tracks, fixtures and cargo. Terrain OBJ export includes exposed underground faces and an open shaft. These provide a concrete reference for rebuilding the same rules and map in Unreal.

## Chop, craft and brace (0.8)

Equip **3** for the free wood axe. Aim at a nearby trunk and hold left mouse: five chops fell it. Wait for it to fall, then **E** collects six logs. Carry up to 24 logs. **G with the axe equipped** drops wood for a friend; E collects their pile. Trees, remaining logs and wood inventories persist.

Press **B**, craft a frame for **four logs**, choose its kit and click a cleared underground floor. The model has round posts, a roof beam, diagonal braces and side rails inspired by the reference photo. Frames protect a nearby 2.6 m region with a clear tunnel between frame and roof; place them about **every four metres**, including each branch. Digging away a frame’s footing disables it. The original shaft and landings give a safe starting point.

Unsupported roof sites accumulate stress while the crew is online: cracks and falling dirt at 45 seconds, red danger at 70, and a collapse at 90. Leaving an empty room freezes the clock. A collapse blocks the passage with **36 kg of sterile rock** and scrambles a nearby miner clear without deleting carried gold. Clear it with three starter-shovel loads (or two heavy-pick loads), recover dropped material, then brace the roof. Clearing leaves about a minute to build a frame before another collapse. Every step works alone.

## Buy better hand tools (0.9)

Visit Mabel’s and buy your own progression. **1** selects your surface shovel. **4** equips your best purchased mine pick. Picks use the familiar **hold left → pull upward → release to toss** gesture on exposed mine rock, including diagonal and downward cuts. **C** still raises your bucket for a catch.

| Tool | Solo price | Mine cut radius | Extra bite beyond the hit | Max load | Swing cooldown | Upward pull |
| --- | --- | --- | --- | --- | --- | --- |
| Starter shovel | Free | 1.6 m | 0.4 m | 12 kg | 1,000 ms | 42 px |
| Steel digging shovel | $85 | 1.6 m | 0.4 m | 12 kg | 650 ms | 42 px |
| Miner’s pick | $65 | 1.8 m | 0.75 m | 14 kg | 650 ms | 32 px |
| Pick-mattock | $210 | 2 m | 1.1 m | 18 kg | 550 ms | 26 px |
| Heavy tunnelling pick | $620 | 2.15 m | 1.4 m | 24 kg | 450 ms | 22 px |

The radius describes the rounded cut brush, clipped to the floor; a whole tunnel’s width depends on overlapping cuts and aim. Steep shaft cuts use smaller radii, 1.1–1.5 m. Cooldown is the minimum time between completed cuts; aiming, lifting and tossing still take time. The mattock requires your own pick; the heavy pick requires your own mattock. Crew prices scale normally, but purchases equip only the purchasing miner. The steel shovel improves surface scoops to 10 kg and deeper cuts; picks are for mine rock.

Bigger cuts are forgiving for solo tunnel construction. Bigger loads fill a starter bucket quickly: a heavy load fills its entire 24 kg capacity. Hauling packs, carts, hoists and supports remain useful progression. This remains stylized gold-bearing material extraction; ore crushing is not implemented yet.

