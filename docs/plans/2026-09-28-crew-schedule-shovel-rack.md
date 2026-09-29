# Crew schedule and shovel rack implementation plan

**Goal:** The D Tent crew head home at the curfew siren, rack their shovels in D Tent, and sleep without them. X-Ray deals until 01:00, then sleeps. Everyone collects their shovel and heads out between 06:00 and 07:00.

**Architecture:** The bots stay client-side in `public/js/30-npcs.js`, and new states drive them from the shared clock. A per-person `stowed` flag in `25-people.js` hides the hand shovel. The D Tent rack becomes six empty slots in the room model (`art/blender/interiors.py`, re-exported headless), plus six runtime shovel meshes, each shown while its owner's shovel is racked.

**Design:** `docs/plans/2026-09-28-crew-schedule-shovel-rack-design.md`

---

### Task 1: Hide the hand shovel when stowed

**Files:** Modify `public/js/25-people.js` (the two lines that set shovel visibility every frame: box `animPerson` and model `animModel`).

1. Where visibility is set from `p.o.shovel`, use `p.o.shovel!==false&&!p.stowed` instead.
2. `node --check public/js/25-people.js`.

### Task 2: Six-slot rack in D Tent

**Files:** Modify `art/blender/interiors.py` (the rack block in `tent_room`), `public/models/TentRoomCrew.glb`, `art/blender/glb/TentRoomCrew.glb`, and `public/js/30-npcs.js`.

1. In `tent_room`, crew rooms get a rack board 2.6 m wide centred at x −2.875 and no built-in shovels. Small rooms are unchanged.
2. Re-export only `TentRoomCrew`: `blender -b art/blender/camp-green-lake-art.blend --python-expr` runs the toolkit, calls `tent_room('TentRoomCrew',9,8.5,crew=True)`, then exports. Copy the GLB to `public/models/`.
3. In `30-npcs.js`, `RACK` has six slots at x = D_TENT.x − 4.0 + k·0.45 on the door wall. Each slot gets a shovel mesh (a handle cylinder and a tilted blade box, the same shapes and colours as the Blender rack shovels), added to D Tent's `ROOM_MESHES` group so it shows only with the room. `slot.mesh.visible` means the shovel is racked. Each bot owns slot i.

### Task 3: The schedule

**Files:** Modify `public/js/30-npcs.js`.

- `curfewSoon()` is true when `clockT() >= DAYMS-60000` (the siren).
- At the siren, any bot in `dig`, `rest`, `walk`, `return` or `gatebackout` heads home via `gateout`. A bot in `leaving` or `gatebackin` turns back to the tent. Once the siren has sounded, walking bots move at run speed.
- At the tent door, the bot moves into the room at the entry point (`z = t.z-roomD+2.6`) and walks to its rack slot (`torack`). It pauses 0.6 s (`racking`), stows the shovel so the slot mesh shows, and walks to its bed approach point (`tobed`). Then it goes `inside`, lying in its bunk or sitting in X-Ray's dealer seat.
- X-Ray deals while the hour is 20:00–01:00, then walks to the sixth D Tent bunk and sleeps.
- When it is day and the bot's wake time has passed, it gets up. The wake time is random, 0–40 s of real time after dawn (06:00–07:00). By day, a break's own timer is used instead. The bot walks to its rack slot (`getshovel`), takes the shovel, walks to the room exit (`toexit`) and steps outside at the door (`gatebackin`). From there the existing route takes it back to its hole.
- Sleeping bots don't chat.
- Day breaks follow the same rack, bed, and collect routine.

### Task 4: Test

**Files:** Modify `tests/smoke.mjs`.

Add a step that pauses the clock, then fast-forwards the crew by calling `updateBots(0.1, …)` in a loop at set hours:
- At 19:00, after the siren, every bot is in a heading-home or indoor state.
- At 21:00, the non-X-Ray bots are asleep with `p.stowed` set and their rack slots showing, and X-Ray is at the table with his shovel racked.
- At 02:00, X-Ray is in a bunk.
- At 08:00, every bot is outside with its shovel.

Run `npm test`, then take a screenshot of the D Tent at night for a visual check.

### Task 5: Commit and push to `jt/next`
