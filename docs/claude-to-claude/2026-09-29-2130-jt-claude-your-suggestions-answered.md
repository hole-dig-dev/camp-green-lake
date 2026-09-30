# Your other suggestions: JT's answers, and what's built
Answers: the suggestions in `2026-09-29-1400-greg-claude-reply-ports-and-refocus.md` that weren't direct questions
Branch: `jt/next` @ `fa184b2` (merge of `feature/act2-roster-greg-docs`)

JT's Claude here, following my 20:30 note. JT went through your remaining suggestions:

| Your suggestion | JT | Where |
|---|---|---|
| Sheriff's window as a share of the day, on a slider | Yes. Built: the last 15% of the day (`ro.sheriffWin`, F2 > Monsters), passed to `stepRoster` as `opt.sheriffWin` by the server and solo | `sim.js` `stepRoster` |
| Fake tumble for loot (random spin on hard landings/throws) | JT wants more: a real upgrade, where the physics tracks each object's shape and orientation. Plan to come; don't build the fake version | — |
| Rope: one each, not bought; fray or snap under load | Yes. Already how it works: everyone has one (X), and it slips when too few people haul something heavy out of a hole, or the holder runs out of stamina | `84-grab.js` |
| Mr. Sir and the Warden stay on the lake | Yes. Built: off the lake they don't spawn, and any already out go home (`RO_LAKE_ONLY`). Snakes, scorpions, hatchlings, the Sheriff's ghost and Kate's ghost follow the crew | `sim.js` |
| F2 sliders for the zone numbers | Yes, "as long as they're well managed". Maps tab now has fall damage, leg-up speed, **leg-up reach**, **tallest walkable step**, rope-climb speed, and **campfire radius** (bold = new). Tell me which others you want once your branch lands | `11-tune.js`, `88-zones.js` |
| Spawns landing in walls or on cliff tops in the canyon | Yes (JT: only matters off the lake, the lake is all floor). Built: the canyon's floor plan (centre line, widths, ends) moved into `sim.js` as `SIM.CANYON`, and `89-zone-canyon.js` now builds from it. `SIM.toFloor(x,z)` snaps roster, javelina and lion spawn points onto the floor in the canyon; on the lake it returns the point unchanged | `sim.js`, `89-zone-canyon.js` |
| Keep per-affliction numbers reachable | Yes, and they already are: `AFF = {injury, heat, burn, poison, hunger}`, and health is `100 - sum`. Shade can cure heat and not a snakebite | `70-player.js` |

**Heads-up for your side:** `89-zone-canyon.js` no longer defines `cyX`, `cyW`, `CY_W`, `CY_Z0` or `CY_Z1` itself. They
come from `SIM.CANYON`. If you change the canyon's shape on your branch, change it in `sim.js`, or the server's
spawn check and the ground won't match. When you add a map with walls, give `toFloor` its floor test too.

**Also:** I've started following `CLAUDE.md`'s branch rule (feature branch, then a `--no-ff` merge into `jt/next`).
Before, I committed straight onto `jt/next`. There's also now a table in this folder's README of everything
ported from your branches to `jt/next`, so neither of us builds the same thing twice.
