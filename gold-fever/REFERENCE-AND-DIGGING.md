# Physical digging and the automation direction

## Reference reviewed, 2026-10-02

The reference is Studio Bitdot's **Needle In A Haystack Simulator**, Steam app 5159870. Several different games now have similar names. Research used the original official Steam description, its two short gallery trailers, gameplay animation and screenshots, and a first-party post from creator Nas Nakarus. The public store still identifies the game as upcoming. This was a review of promotional gameplay footage and published descriptions, not a hands-on playtest or exhaustive review of the final game's upgrade tree.

### Observed or stated by the original developer

- One daunting physical search space: five million hay pieces and one needle.
- Players begin by manually separating material. Individual pieces can be moved; the footage shows loose pieces, readable hover selection and the search happening directly in first person.
- Valuable discoveries fund increasingly powerful equipment. Moving and processing more material is the progression, rather than combat levels.
- Tools occupy the player's view and are visible in the co-op scene. Gallery imagery shows a broad held blower-like tool and workers with hand tools.
- The official automation screenshot shows multiple conveyor sections assembled beside the pile, with loose hay on the belts. Automation exists spatially in the work area.
- Co-op players share the same oversized task. Simple exaggerated workers and physical material create readable situations.
- The developer explicitly describes eventual automation processing the haystack. An optional pure mode removes tools and automation.

### What the available footage does not establish

Exact prices, processing rates, complete machine list, reliability/jam rules, the full conveyor connection contract, and every eventual upgrade are not confirmed. Treat those below as **our design**, rather than claims about Needle's implementation.

Sources: [original Steam page and gallery](https://store.steampowered.com/app/5159870/Needle_In_A_Haystack_Simulator/), [Studio Bitdot's site](https://needleinahaystacksimulator.com/), [creator's account and development post](https://uk.linkedin.com/in/nas-nakarus-3846b1202).

## The feeling to carry over

An intimidating amount of material becomes manageable because players earn ways to replace their own repetitive jobs. The mess should remain visible: holes show excavation, heaps show misses, a loaded barrow looks heavy, and a running sluice shows where material goes. Players should be able to point to the operation and understand its bottleneck.

Progress should change an action: a bigger shovel changes the lift; a barrow replaces repeated bucket walks; a sluice replaces hand swirling; a conveyor replaces repeated barrow trips. A percentage boost alone cannot carry a whole stage.

Keep discoveries uncertain and location-dependent. More throughput processes more real paydirt; it does not conjure money from a magic idle generator. The pan remains useful for sampling a new claim even when the crew owns an absurd industrial plant.

## Gold Fever progression: proposed automation jobs

| Stage | Manual job | Upgrade that takes over | Player's new responsibility |
| --- | --- | --- | --- |
| Shovel, wooden bucket, pan | Dig, aim each scoop, carry and swirl | Stronger blade, sieve, larger bucket | Select better soil and keep loads manageable |
| Rocker and wheelbarrow | Pan every sample; walk every bucket | Rocker processes bulk loads; barrow carries several buckets | Feed gravel, crank, brake and clean up gold |
| Creek sluice and waterworks | Crank constantly | Flowing water washes unattended | Place intake, feed hopper, manage water and tailings |
| Waterwheel feeder and short belts | Load every scoop and push every haul | Ground hopper feeds a visible belt into the sluice | Connect actual inlet/outlet positions and move the line as the claim deepens |
| Steam winch, scraper and ore carts | Dig and carry all material | Scraper repeatedly drags a real soil cut to a hopper; winch hoists mine loads | Choose excavation direction, route loads and clear recoverable obstructions |
| Ridiculous excavator and dump truck | Hand-dig and barrow everything | Bulk excavation and bulk hauling | Scout pay layers, drive safely and avoid overflowing processing capacity |
| Trommel plant and route automation | Drive the same loop repeatedly | Recorded haul routes and an automatic feeder | Lay out the quarry, adjust routes, supply water and collect concentrates |
| Absurd late operation | Supervise each small cut | Bucket-chain dredge / walking steam shovel / oversized monitor array | Plan the next claim, repair the weakest link and recover spectacular accidents |

Current browser build has the pan, rocker, wheelbarrow, automatic sluice/wash plant, manually operated excavator/truck/hydraulic rig. **Belts, waterworks, winches, autonomous routes, dredges, volumetric mines and underground tunnels remain future work.** The 15–25 hour campaign is not yet balanced.

Historical foundations: pans, rockers and sluices separate gold from gravel with water; hydraulic equipment and later dredges increased the scale. See [NPS, Kantishna Gold](https://home.nps.gov/articles/kantishna-gold.htm) and [NPS, gold dredge development](https://home.nps.gov/yuch/learn/historyculture/walter-johnson.htm). The modern dump truck remains a deliberate late-game anachronism requested for this goofy version. Give advanced machines wooden cabins, brass fittings, smoking boilers and oversized levers to keep the frontier identity.

## Visual direction

Rough, bright, low-poly and physically readable. Exaggerated noses and eyes, oversized crooked felt hats, moustaches, neckerchiefs, suspenders, rolled shirts and heavy boots. Worn wood, rusted iron and brass should dominate early tools; add ridiculous scale to later equipment. The initial character changes in 0.4 add tilted wide hats, enlarged facial features, moustaches, suspenders and red bandanas. These are stylized period cues, not a reconstruction of one exact year.

The humour should come from jobs colliding: a shovel load missing a bucket, a friend accidentally feeding the wrong hopper, a hill of dirt spilling onto a route, an overloaded wheelbarrow tipping beside the line. These are testable situations. Scripted checks cannot establish whether humans find them funny or share clips.

## Playable physical shovel, version 0.4

1. Press **T** to put the wooden bucket down in front of you. Its open top is the receiver.
2. Aim at nearby dirt and **hold left mouse** to plant the blade. A stationary held click does not repeat digs.
3. **Drag upward** while holding to lift one scoop. The scoop sits visibly on the blade; the shared ground is cut at this point.
4. Aim at the bucket, a wheelbarrow tray, a washer inlet or a truck bed. **Release** to toss. A fast recent mouse movement throws farther; a gentle release travels a short distance. If you release while the lift confirmation is arriving, the toss is queued.
5. The clods follow gravity, bounce on ground, and enter a container only when they descend through its opening. Full containers accept only remaining capacity; overflow becomes loose dirt.
6. Missed paydirt settles into a recoverable pile. Pick up the bucket with **T**, then **E/X** retrieves loose dirt. **R** pans your collected dirt at the creek.

The shovel follows mouse movement with damped translation and rotation. The camera stays steady while the blade is planted; after lifting, mouse motion aims normally. In the Codex panel's capture fallback, left drag still lifts the blade; right drag aims the view. Keep the tool selected with **1**; **2** selects the pan.

The server owns the load and every physical clod. Each scoop becomes five cargo-bearing clods; their kg, contained gold and original sampling location survive catching, partial overflow, settling and recovery. Other players see the held load, dirt flight, bucket contents and changed ground. You can shovel directly into their placed bucket without assigning permanent roles.

## Technical limits and later engine work

The terrain is still a **224 × 224 m heightfield**, with vertices every 2 m. Exposed dirt now has grain, pebbled texture and darker soil colours; this does not create underground caves or fully granular terrain. Flying dirt is a bounded parcel simulation with simple clod shapes, gravity, ground/building collisions and container opening tests. It does not simulate every grain, full rigid-body contacts, clod-to-clod collisions or shovel contact forces. The first-person held tool is a responsive model rather than a general R.E.P.O.-style rigid-body grabbing system.

Separate the contracts for an eventual Unreal implementation:

- `shovelPlant` establishes a nearby cut; `shovelLift` validates a deliberate pull and moves the excavated parcel onto the blade.
- `shovelThrow` releases conserved parcels with a bounded impulse.
- `bucket` places/picks up the personal container.
- `clods` retain physical state plus cargo; `shovel` retains pending cargo; `bucketPos` persists a placed bucket.
- `shared/soil.mjs` has no browser, graphics, networking or filesystem imports. Unreal can reuse the action/state design and numeric tuning while replacing rendering and collision with native actors/physics.

Next gate: tune this actual mouse feel with the user and a friend before making conveyors or mines. Then build one spatial chain—placed dirt hopper → short belt → sluice—with visible dirt throughput, overflow and a recoverable jam. Verify solo sequential use, two-player cooperation, and bounded eight-player simulation before broadening the map.

## Carried-bucket catch, version 0.5

After lifting a scoop, hold **C** to raise the bucket and move the mouse to position it. Releasing the loaded shovel while C is held lobs the dirt upward; move the bucket underneath during flight and keep C held until the catch. C temporarily routes mouse motion to the bucket; right-drag looking still works when C is released in the Codex panel. T still places the bucket for normal aimed throws.

An uncaught catch lob rebounds into your face, covering the world with brown mud for three seconds. Ordinary thrown dirt can also hit a friend's face. Their vision is affected, and the crew sees their muddy character. A full bucket lets overflow through. The mud expires automatically and all missed dirt remains recoverable. This rebound is deliberately cartoon physics, not a simulation of real soil elasticity.
