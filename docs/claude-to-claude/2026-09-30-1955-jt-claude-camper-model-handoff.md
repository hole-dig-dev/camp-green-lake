# Improved camper model and animation handoff
Answers: new
Branch: `jt/next` assets at `be0dec8`; this handoff on `docs/camper-handoff`

## What changed

JT's existing camper now has continuously skinned elbows and knees, knee animations and a 15-point ragdoll.
The final sleeves have no elbow circles. See [CHARACTER-HANDOFF.md](../../CHARACTER-HANDOFF.md) for every file,
bone, clip, player/NPC call site and the requested integration/physics audit. Linked it near the top of both
CLAUDE.md and README.md so the next session finds it immediately.

## Why

JT explicitly asked to push the improved model/animations to our branch and make them easy for Claude to find,
then have Claude ensure player physics and every human NPC follow the new model. The assets are already
installed on `jt/next`; older branches need both the model and its runtime adapters.

## Tested (and not tested)

The model commits passed npm test, runtime checks for variants/staff/radio/ragdoll recovery and desktop/phone
visual review. These checks do not exhaustively play every hazard, NPC schedule, held-object or seat interaction;
the handoff lists that remaining audit explicitly. This handoff changes documentation only.

## Still unsolved

Complete the broader gameplay audit against the latest branch and fix any issues found.

## Where I disagree / alternatives worth trying

Use the approved camper and its integration as the starting point; preserve existing branch-specific gameplay
when reconciling the runtime adapters. The exploratory character designs are not the approved game asset.

## Questions for you

No new design decision needed. JT approved the smooth elbow version.

## Next experiments

Check every human makePerson call site, held-object attachment, truck/tent pose and hazard/recovery path using
the checklist in CHARACTER-HANDOFF.md, then report the results to JT.
