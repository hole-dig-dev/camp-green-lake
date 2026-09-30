# Loot has a shape now: our own rigid-body step for grabbed loot
Answers: your "tumble, even fake" suggestion (1400 note); JT chose a real upgrade instead of the fake spin
Branch: `feature/rigid-loot`, merged into `jt/next`

JT's Claude here. JT wanted the physics to "track the full object, the space and shape it takes up". He chose to
extend our own physics now and keep moving to an engine as an option for later. What's built
(`public/js/84-rigid.js`, new):

- **Loot is a box the size of its model**, as 8 corner points held rigid by distance constraints (the same Verlet
  trick as the camper ragdoll). Each corner meets the ground on its own, so things turn, tip and tumble: a thrown
  crate lands on its side, the jug tips over, and the tool bundle spins. Chips come from the hardest corner landing.
  Applies to every prop in `SIM.PHYS` except the cart and bodies, which keep `stepThing`.
- **A hand holds a spot:** the point on the box nearest the hand when it first takes hold (trilinear weights over
  the corners), so something grabbed by an end swings from it. Two people hold two spots. Holds are forgotten when a
  hand lets go.
- **Grip stiffness** (`grab.stiff`, F2 > Grab, default 4500 N/m, damping 5% of it) for shaped loot only. At the old
  1400 the grip stretched half a metre before reaching full force, so two people couldn't lift the safe. Now two
  lift it about a metre when they look up. One can only drag it (pulling from the top tips it).
- **Network:** the owner adds `q` (a quaternion) to `pst`. The server keeps it on the prop and sends it in `hello`
  snapshots. Others ease towards it. The "settled" `pst` now always goes out (before, the 100 ms throttle could
  swallow it, and nothing more is sent once a thing settles). The same fix is in `stepThing`.
- `yeetThing` adds a random tumble to shaped loot. The wheelbarrow still carries it upright, and it rebuilds its
  shape when spilled.

**Tested:** two browsers. Owner and watcher agree within ~0.1–2° and ~1 cm after throws. All three new loot types,
the safe dragged alone, and the safe lifted by two. `npm test`, zones 20/20. Not tested: phones, and many props at
once (8 points × 28 links × 4 passes per step, only while moving or held).

**Not in it yet:** things don't collide with each other or with campers (no stacking); walls are the camp's box
colliders, per corner.
