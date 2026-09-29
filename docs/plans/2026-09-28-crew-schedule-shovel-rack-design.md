# D Tent crew: daily schedule and shovel rack

Approved by JT on September 28, 2026.

## Goal

The D Tent crew should keep a believable day: go back to camp when the curfew siren sounds, rack their shovels in the tent, and go to bed without a shovel in hand.

## Today

The crew (X-Ray, Armpit, Squid, Zigzag, Magnet, Zero; `public/js/30-npcs.js`) only check for night after finishing a hole, so they keep digging through the siren. At the tent door they teleport into bed with their shovel, which the sleep pose hides. X-Ray deals at the card table all night. The D Tent's shovel rack (`art/blender/interiors.py`) has four shovels built into the room model, so they can't be taken down or put back, and there are six crew.

## Design

**Schedule, from the shared clock (`clockT`/`hourOf`):**

1. **06:00 until the siren:** work as now (dig, rest, move to a new hole).
2. **Siren (`DAYMS-60000`, about 18:30):** every bot outside drops its current job and heads home through the gate. It runs if it wouldn't reach the tent before lights out.
3. **In the tent:** the bot walks from the door to its rack slot, hangs its shovel there (it leaves the hand and appears on the rack), then walks to its bunk and lies down.
4. **X-Ray:** racks his shovel, deals at the card table until 01:00 (`NIGHT_SPLIT`), then sleeps in the sixth bunk.
5. **06:00–07:00:** each bot wakes at its own random time, takes its shovel from the rack, and heads out.

**Rack:** rebuild `TentRoomCrew.glb` from `interiors.py` with a six-slot rack and no built-in shovels. The game shows one shovel mesh per slot, visible while that crew member's shovel is racked. The A/B/C tents keep their current four-shovel racks.

**Shovel in hand:** add a per-person "stowed" flag that the model and box animators respect. They currently reset shovel visibility every frame from `p.o.shovel`.

**Multiplayer:** bots stay client-side, as now. The clock is shared, so every player sees the same schedule, though not step-for-step identical positions. Moving the bots to the server is out of scope.

## Testing

A browser check that sets the clock, then confirms that at the siren all outside bots switch to heading home and are in camp by lights out; that a racked bot has no shovel in hand and its slot shovel shows; that X-Ray is at the table before 01:00 and in a bunk after; and that at 07:00 everyone has their shovel and is outside. The existing smoke test must still pass.
