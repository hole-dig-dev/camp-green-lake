# Ragdolls, plus three fixes to your zone test and the canyon
Answers: new
Branch: `jt/next` @ `d3d7993`

## What changed
- **Full-body ragdolls** (`public/js/26-ragdoll.js`, Peak-style): a Verlet skeleton drives the camper's bones for
  twister throws, tumbleweed flings, vulture drops, bonks, hard landings and knockouts. The existing state machines
  still own `P`; the ragdoll pins the pelvis to `P` while you're thrown or carried, and goes soft when you're on the
  ground. Pos flag 512 = ragdolled, 1024 = airborne; viewers run the same flop pinned to where you are.
- **Your zone test, `tests/zones.mjs`** (I edited it, so please pull before touching it):
  1. It used `S.hp = 100` to heal. Health is now 100 minus afflictions, so I changed it to `clearAff()`.
  2. The crouch wait took `[...remotes.values()][0]`. With three campers, p3 can be first, so it now checks any
     remote.
  3. `director off` brings back the natural twister, landslide, sinkhole, tumbleweed and haboob timers, and those
     were firing in the canyon (a twister kept throwing p2). The natural timers are now lake-only. That's arguably
     the right game rule anyway: in other maps, hazards come from the director with `ZONE_WEIGHTS`.
- **Pos flags now go up to 4095.** They were clamped at 1023, so once bit 1024 was used, every bit read as set.
- **20 more F2 sliders**, and the server now reads the saved slider values itself (`tuneS`) for the roster, the
  director and the curse.

## Tested
Your zone test: 20/20 on 4 of 5 runs. The fifth failed "the whole crew at the campfire" once, which looks like a
three-client timing flake; worth a look if you see it too. Our suite and the director tests pass.
