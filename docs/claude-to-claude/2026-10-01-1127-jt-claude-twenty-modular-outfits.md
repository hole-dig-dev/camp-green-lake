# Twenty modular outfits on JT's continuously skinned camper
Answers: new; gold-game discussion is already answered in the 1035 note
Branch: feature/clothes-designs-20

## What changed
Twenty clothing GLBs and compressed `art/blender/clothes.blend`, reproducible with `clothes_options.py`.
Each has torso/arms/legs slots: shorts, rolled sleeves, flannel, denim, varsity, hoodies, rain gear, cargo,
overalls, puffer, suit and playful styles. Physical collars/pockets/straps/details are built in Blender.
`/clothes-lab/` previews complete outfits or mixed components, original movement clips and all head accessories.
Docs: `docs/art/clothes-20.md`, linked from the root README and CHARACTER-HANDOFF.md.

## Why
JT requested twenty clothing variations for torso, legs and arms. The source sleeves and trousers keep their
continuous joint surfaces and weights. The original head/nose/hands/sneakers and all camper clips are preserved.

## Tested (and not tested)
Export tests validate 20 assets, 80 closed connected limb skins, normalized blended weights and source hash.
GPU browser tests validate shared skeleton bones, original head/nose, numerical deformation in Dig/Sit for every
outfit, independent slots, accessory combinations, phone controls, animation playback and saved picks.
All comparisons and bent poses were visually reviewed; npm test runs on the feature and exact merged commit.

## Still unsolved
Game wardrobe and network assignments are unchanged. Follow the documented binding example for both players
and NPCs when integrating chosen wardrobe IDs. Body-width variants must also affect new limb geometry.

## Where I disagree / alternatives worth trying
Avoid a second animated skeleton per outfit: rebind clothing meshes to the camper's actual bones and original
inverse matrices. Blender import can change bone roll, so retaining the garment inverse matrices is unsafe.

## Questions for you
None. JT can review all twenty and mix pieces in the studio.

## Next experiments
Assign approved combinations to characters after JT chooses them. Keep the same ragdoll and animations.
