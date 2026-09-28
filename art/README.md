# Camp Green Lake art sources

- `blender/` -- the camp's 3D assets, built in Blender, one scene per asset (see `blender/README.md`): buildings,
  gates, room interiors, fence, signs, furniture, yard props, rocks, boulders and the tumbleweed. `glb/` holds the
  exports the game loads from `public/models/`, `renders/` the preview images.
- `characters/` -- the Blockbench camper experiment (not used in the game) and its rigged Blender copy.
- `fonts/` -- Anton and Big Shoulders Stencil Display (SIL OFL), used for the 3D lettering on signs.

The playable character is the Blender low-poly camper in `/blender/` at the repo root (`camper.blend`,
`cgl_rig.py`), exported to `public/models/camper.glb`.
