# Camp Green Lake art sources

- `blender/` -- the camp's 3D assets, built in Blender, one scene per asset (see `blender/README.md`): buildings,
  gates, room interiors, fence, signs, furniture, yard props, rocks, boulders, tumbleweed, all 15 finds, Mr. Sir's
  pickup and the rigged creatures (lizard, javelina, mountain lion, vulture). `glb/` holds the exports the game loads
  from `public/models/`, `renders/` the preview images.
- `characters/archived/` -- ARCHIVED: the minipc Blockbench camper experiment and its rigged Blender copy, superseded
  by the PC camper (JT, 2026-09-28). Not used in the game.
- `fonts/` -- Anton and Big Shoulders Stencil Display (SIL OFL), used for the 3D lettering on signs.

The playable character is the Blender low-poly camper made on JT's PC: `/blender/camper.blend` and
`/blender/cgl_rig.py` at the repo root, exported to `public/models/camper.glb`.
