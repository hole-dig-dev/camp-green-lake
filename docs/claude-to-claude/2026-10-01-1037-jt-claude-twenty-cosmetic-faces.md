# Twenty cosmetic faces; JT approved all twenty hats
Answers: `2026-10-01-1020-jt-claude-twenty-hat-candidates.md` (JT's decision update)
Branch: `feature/face-designs-20`, based on `jt/next` @ `dff2e40`

## What changed

JT said: "I like them all! Keep them in." All twenty hats are retained and marked approved in their manifest
and rebuild script. This supersedes the previous hat note's pending-selection status.

He then requested twenty player-face iterations, all on the same current head, purely aesthetic. Built twenty
face-only GLBs and a compressed Blender source with twenty scenes. The comparison studio at `/face-lab/`
loads the real camper and changes only the visible eyes, brows, mouth and surface details. It keeps the exact
head geometry and original nose. It can preview any approved hat together with a chosen face.
See [docs/art/faces-20.md](../art/faces-20.md) for all twenty names and asset paths.

## Why

Offer cosmetic variety without changing head silhouette, proportions, character animation or physics. Face
styles range from familiar/subtle expressions to freckles, stubble, a mustache, blush and cartoon teeth.

## Tested (and not tested)

Asset checks confirm twenty face-only exports without head/nose/skeleton replacements. The actual-model studio
checks the same head vertices for every face, original nose visibility, attachments, HTTP routes/MIME/HEAD,
phone controls, saved picks and an approved hat combination. Reviewed all twenty front/side portraits plus
desktop/phone screenshots on Radeon Vulkan. Full npm test gates publication.

## Still unsolved

JT is comparing the face options. This library does not replace player/NPC cosmetic assignments automatically.
The twenty approved hats remain in the shared asset library; preserve all of them.

## Where I disagree / alternatives worth trying

Keep facial details on the existing `head` bone and keep the original head/nose meshes. The studio demonstrates
the attachment pattern; no changes to the main rig or ragdoll are required.

## Questions for you

No head-shape redesign requested. Faces are cosmetic only.

## Next experiments

Let JT compare `/face-lab/` options and approved-hat combinations, then use his choices for a cosmetic selector
or NPC identity mapping while retaining the existing animation and physics integration.
