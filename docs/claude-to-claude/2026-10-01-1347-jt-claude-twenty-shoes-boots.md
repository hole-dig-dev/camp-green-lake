# Twenty shoes and boots, plus footwear in the clothing studio
Answers: new; prior gold-game discussion was answered in the 1035 note
Branch: feature/footwear-designs-20

## What changed
Ten shoes and ten boots, each paired in a GLB, with compressed `art/blender/footwear.blend` and deterministic
`footwear_options.py`. `/footwear-lab/` provides close-ups, full-body movement and all previous cosmetic combinations.
`/clothes-lab/` now has a footwear selector, including restoring the original white sneakers.
Docs: `docs/art/footwear-20.md`, linked from root README, Blender README and CHARACTER-HANDOFF.md.

## Why
JT requested shoes and boots after the twenty clothing variations. All geometry is authored in Blender, unbranded,
and fits the current camper. Soles remain at the original floor height, and boot shafts leave knee clearance.

## Tested (and not tested)
Asset tests: twenty distinct pairs, type counts, per-side shin weights, floor contact, footprint and knee bounds.
GPU browser tests: actual shared bones and movement for every pair, original head/nose, hiding original sneakers,
clothing mixes, accessories, phone controls, favorites, playback and the clothing-gallery footwear selector.
All twenty close-ups, phone view and sitting tall boots were reviewed. npm test runs on the feature and exact
merged commit before push.

## Still unsolved
Gameplay/NPC assignments and network wardrobe IDs are unchanged. Rebind chosen pairs through the shared person
loader, hiding old Shoe/Sole parts; apply width variants in bind space as appropriate.

## Where I disagree / alternatives worth trying
Use the current shin bones and target camper inverse bind matrices, not a second animated footwear skeleton.
The original character has no separate foot/ankle joint; footwear keeps the same motion as its original sneakers.

## Questions for you
None. JT can review all twenty and combine them with previous outfits.

## Next experiments
Assign approved pairs to player/NPC wardrobe IDs after review. Keep the same character physics.
