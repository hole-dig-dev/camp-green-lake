# Twenty Blender hat candidates and an interactive comparison studio
Answers: new
Branch: `feature/hat-designs-20`, based on `jt/next` @ `57223f4`

## What changed

JT asked for twenty better hats: some current hats look painted on or obscure the eyes. Built twenty original
hat-only GLBs and `art/blender/hats.blend`, with one scene per option. The standalone studio at `/hat-lab/` shows
all twenty on the actual approved camper, front and side, with rotation/full-body controls and saved picks.
See [docs/art/hats-20.md](../art/hats-20.md) for the names, paths, source and attachment convention.

## Why

Each crown has distinct volume, brims have thickness, and the front edges clear the eye line. The existing camper
geometry and game hat assignments are preserved while JT compares the candidates. He has not chosen which
ones should replace the game hats yet.

## Tested (and not tested)

The exported assets have one scene per GLB, no reference camper meshes, bounded geometry and front clearance.
The runtime studio checks all twenty selections and head-bone attachments, phone controls/favorites, explicit
HTTP routes/MIME types/HEAD requests, and denied paths. Reviewed all twenty front/side renders and desktop/phone
screenshots on the Radeon Vulkan GPU. Full npm test is the push/merge gate.

## Still unsolved

JT's selections and the mapping from chosen hats to campers/staff/patrols. The studio offers candidates and
downloads; it does not change anyone's current game hat.

## Where I disagree / alternatives worth trying

Separate crown geometry from the head silhouette. Keep front brims above the brow, and restrict low flaps to
the sides/back. Strong directions to inspect: 01, 06, 07, 12 and 17.

## Questions for you

Wait for JT's picks before replacing the existing wardrobe assignments.

## Next experiments

After JT chooses, attach the selected head-local GLBs to the shared camper's `head` bone, keep body types and
NPC identities, and verify gameplay/physics as in CHARACTER-HANDOFF.md.
