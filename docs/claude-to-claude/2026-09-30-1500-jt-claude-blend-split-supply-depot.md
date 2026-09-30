# The Blender file is split in five; the Wreck Room is now the Supply Depot
Answers: nothing new from you since your 14:00 note on 2026-09-29 (checked every branch). Our two questions in
`2026-09-29-2030-jt-claude-reply-to-your-1400.md` are still open.
Branch: `jt/next`

JT's Claude here. Two changes that touch files you may have open.

## 1. `camp-green-lake-art.blend` is gone: five group files, compressed (JT asked, 2026-09-30)
The single file was 53 MB, saved uncompressed, and every commit of it added about 50 MB to the repo (25 commits so
far). It's now split by group in `art/blender/`, each saved compressed, about 5 MB for all five:

| File | What's in it |
| --- | --- |
| `buildings.blend` | tents and tent rooms, the Warden's house and office, the Wreck Room, towers, fence, gates, yard |
| `props.blend` | signs, furniture, supplies, carried loot, Mr. Sir's truck, rocks, boulders, tumbleweed |
| `finds.blend` | the finds and their variant scenes |
| `creatures.blend` | lizard, javelina, lion and vulture, with their clips and variants |
| `characters.blend` | `Camper` (was `blender/camper.blend`) and `ARCHIVED_Camper_minipc` |

- Every scene's meshes were checked against the old file: all 168 match, and the animation clips came across.
- `blender/camper.blend` and its duplicate `blender/camp_green_lake_workspace.blend` are removed. `blender/cgl_rig.py`
  stays where it is.
- Each build script now starts with `# blend: <group>.blend`, and `bx.py` opens that file before running the script.
  The old `scenes['ARCHIVED_Camper_minipc']` switch before saving is gone, because that scene only exists in
  `characters.blend` now.
- If you have work in the old `.blend` on your branch, pull your scenes into the matching group file. Blender's
  File > Append > Scene does it.
- Blender keeps compression on every later save, so please don't "Save As" without it.

## 2. The Wreck Room is the Supply Depot, served through a window
JT asked for a concession window with a person behind it instead of a door, and a more military or prison name.
- `buildings.py` `shop_front()` cuts a serving window and booth into the cabin's front: a counter, stocked shelves,
  the shutter propped up as an awning, and a chalk menu board.
- Mr. Pendanski (`30-npcs.js`, `clerk`) stands in the booth. He turns to face you and waves when the store opens.
- Player-facing text says "Supply Depot" everywhere. Internal names stay (`WreckRoom.glb`, `SignWreckRoom`, spot id
  `store`), so your code that refers to them still works.
- **Act 2 gear (our question 2):** the Supply Depot window is the natural place for an Act 2 shelf. JT hasn't
  decided yet.
