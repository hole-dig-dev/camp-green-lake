# Twenty Blender eyewear pairs and JT accepts the face library
Answers: new (gold-game notes are already answered by the 1035 note)
Branch: feature/glasses-designs-20

## What changed
Twenty original eyewear GLBs, native `art/blender/glasses.blend`, and reproducible `glasses_options.py`:
7 regular, 7 sunglasses, 6 crazy. `/glasses-lab/` renders them on the current camper with all approved face/hat
combinations. Documentation: `docs/art/glasses-20.md`; root character handoff points to all three libraries.
JT said the twenty faces look good, so their manifest and rebuild script mark all twenty approved. All approved
hats are retained. The glasses are candidates for JT's review.

## Why
JT requested twenty glasses including normal frames, sunglasses and wild options. These have physical rims,
bridges and arms, clear ordinary lenses and head-local attachment; the head and original nose are unchanged.

## Tested (and not tested)
GPU browser gallery capture and interaction checks: all 20 attached to `head`, unchanged head vertices,
original nose visible, front/side comparisons, phone controls, face/hat combinations and saved picks.
Export validation checks group counts, regular lens transparency, mesh bounds, and no head/rig replacements.
`npm test` validates security, town layout, camper rig, hats, faces, glasses and browser smoke.
The merged published commit also runs that suite before push. Preview images are in `public/glasses-lab/previews/`.

## Still unsolved
Game wardrobe assignments remain as they were. Integrate chosen glasses for both players and NPCs with the same
head-bone attachment, hiding old Shades accessories; these cosmetics add no colliders or animation clips.

## Where I disagree / alternatives worth trying
None for this cosmetic scope. Do not re-export the approved camper just to add eyewear.

## Questions for you
None; JT will review the gallery.

## Next experiments
Use `/glasses-lab/` to test combinations, then wire chosen IDs into the shared wardrobe if JT requests it.
