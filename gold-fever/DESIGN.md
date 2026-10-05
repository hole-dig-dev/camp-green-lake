# Gold Fever — developed game concept

## The promise

Two broke, ridiculous prospectors arrive at a frontier town. They initially spend minutes working a handful of gravel. A hard-earned discovery becomes the foundation of a mining operation. Eventually a dump truck rumbles past the wooden assay office while the same crew argues over where to put the next test pit.

The early tools draw from gold-rush methods. Later machinery deliberately mixes eras. First-person play and goofy oversized characters connect the intimate panning phase to the spectacle of industrial excavation.

## The playable foundation

The current world is a 224 metre square valley with a winding creek and town. Players choose their own digging sites. Four hidden geological deposits contain richer buried gravel, with scattered surface traces around the creek. Gold content depends on position, depth and previous excavation. Larger equipment cannot create deposits or automatically locate them.

The player learns through a physical loop: dig, haul, wash, inspect a sample, compare it with earlier results, choose the next test, and decide whether the ground justifies further investment. Terrain edits persist and replicate to the entire crew.

## Progression follows the work

| Problem | Early answer | Later answer | Expansion opportunity |
| --- | --- | --- | --- |
| Find productive ground | Pan samples and field journal | A scouting player supports the industrial crew | Core drilling, sample stakes, old maps, better geological clues |
| Reach the pay layer | Shovel and pick | Excavator or hydraulic rig | Hard layers, stripping topsoil, underground drifts |
| Move gravel | Bucket and hauling pack | Excavator-to-truck transfer | Wheelbarrows, horse carts, rail carts, conveyors |
| Separate gold | Pan, then hand-operated rocker | Continuous sluice and trommel wash plant | Screen sizes, riffle tuning, multi-stage recovery |
| Supply water | Work beside the creek | Integrated washer feed within creek reach | Ditches, flumes, reservoirs, pumps and pressure |
| Fund the operation | Sell personal pouch gold | Pool the crew's earnings | Claims, leases, equipment auctions, operating expenses |

Historical pans, rockers, sluices and hydraulic methods separated heavy gold from lighter gravel using water. They operated under different water and site constraints, rather than forming one universal replacement ladder. [National Park Service: placer mining](https://www.nps.gov/yuch/learn/historyculture/placer-mining.htm), [California State Parks: mining technology context](https://www.parks.ca.gov/pages/980/files/appendix%20f-1%20-%20historical%20context(1).pdf).

The current prototype includes a physical camp wheelbarrow: safe loads, overloaded turns, brakes, teammate steadying, recoverable spills and tumbles. The next expansion is a genuine water-supply network, giving early teamwork more physical jobs before the first excavator.

## Difficulty

Progress depends on both finding better gravel and increasing processing capacity. The starting bucket forces frequent decisions. Surface traces can produce only tiny returns; repeated deep tests at a promising site can reveal much more valuable gravel. Buying heavy machinery before proving a claim ties up a substantial portion of the crew's money.

Equipment dependencies establish milestones. They currently use ownership of the prior processing tier. A future version should also require a productive claim, waterworks and site preparation before industrial purchases become useful.

Tune difficulty around the first meaningful discovery, the first crew-funded rocker, and the first bulk gold clean-up. Watch whether players can explain why their chosen location is promising. If they cannot, add better observable clues before making rewards more common. The current game's hours-to-upgrade targets have not been established through human sessions.

## Multiplayer

Private rooms support one to eight players, with a creator-configured capacity and equipment price scale that persist through disconnects. Players share terrain, machinery and a treasury. Inventory, pan samples and recovered pouch gold are individual. The server owns excavation, recovery, buying and transferring, so two players cannot independently spend the same funds or occupy one driver's seat.

Natural roles emerge from bottlenecks: a scout tests ground, a digger supplies gravel, a hauler moves it, and an operator tends the rocker. Roles can change at any time. Industrial equipment should make coordination valuable without requiring a rigid class selection screen.

The current build uses cooperation within one crew. Separate crews, claim disputes, staking rules and public servers need another design pass before implementation. A shared room economy makes the first version easier to understand and test.

### Expanded campaign: one to eight players

Eight is the maximum, not the required group size. Build and balance the expanded campaign around a complete two-player experience, then verify solo viability and larger crews independently.

- Every core progression task must be achievable by one player, including hauling, water supply, underground mining and industrial automation. Additional people improve speed, safety and coordination; do not require simultaneous controls or fixed classes to unlock progress.
- Give solo players practical alternatives: smaller loads, brakes/chocks, anchored winches, ramps, persistent valve settings and switches reachable from safe positions. A solo player can perform tasks sequentially that a pair performs together.
- Keep solo play harder through extra trips, slower work, limited carrying capacity and greater risk without an immediate rescuer. Do not add invisible solo-only damage penalties or unavoidable hazards that require another person.
- Two players can operate the entire chain by switching jobs. Three to eight players can split into smaller teams and use shared handoffs; no job permanently consumes one player's attention merely to keep it running.
- Solo players can retreat, use a finite self-aid consumable or choose an immediate camp respawn when downed. Death still loses carried recovered gold and leaves gear/cargo for recovery; camp loaner tools prevent a recovery dead end.
- The host's configured crew size determines economic scaling, not a requirement that everyone remain online. At least one player can continue work when crewmates log off, and prices do not fluctuate with disconnects.
- Verify complete progression paths with one and two players before validating throughput and difficulty for four and eight. Treat 15-25 hours as the coordinated-crew balancing target; solo progress may take longer.

## Comedy and escalation

See [the co-op appeal analysis](COOP-ANALYSIS.md) for the researched reference comparison, 34 transferable aspects, 20 scenario examples and prototype priorities.

Clippable co-op comedy is a core requirement. The current build has exaggerated prospectors, emotes, oversized equipment and a first physical hauling/recovery encounter. Wheelbarrow tipping, shared spills, teammate steadying and help-up interactions are implemented. The broader interactions below remain expansion work; human reactions have not yet been evaluated.

The useful reference pattern is a valuable shared task, an awkward physical commitment, a readable mistake, and an attempted rescue. R.E.P.O.'s official description emphasizes physics-based handling of valuable cargo and proximity voice; PEAK emphasizes consequential mistakes during cooperative climbing. Applying those patterns to mining is a design inference, not proof of what caused either game's commercial success. [R.E.P.O.](https://store.steampowered.com/app/3241660/REPO/), [PEAK](https://store.steampowered.com/app/3527290/PEAK/).

### Signature situations

| Stage | Interaction | An example moment |
| --- | --- | --- |
| First expedition | Heavy buckets and overloaded wheelbarrows gain momentum, wobble, tip and spill recoverable material | One player tries to brake a valuable load on a slope while their friend dives in front to catch it |
| First rescue | Impacts and falls can temporarily tumble a prospector; teammates can grab, drag or carry a downed friend | The would-be rescuer slips into the same muddy pit and needs a third person's help |
| Waterworks | Powerful hoses need bracing; valves visibly and audibly change pressure before recoil or leaks | Someone increases the pressure while their friend is holding the nozzle |
| Mine hauling | Ore carts have brakes, inertia, couplings and a clearly marked ride interaction | A downhill cart delivers both the ore and its protesting passenger to the wrong stop |
| Industrial claim | Dump beds, excavator buckets and conveyors interact with players and physical cargo | A worker rides a conveyor toward a transfer chute while a friend races for the stop switch |
| Advanced operation | Winches, huge excavation rigs and powerful pumps amplify familiar physical rules | A crew's improvised recovery of a stuck truck becomes more complicated than the original mining job |

These situations must be possible through ordinary useful actions, including during the first 10-15 minutes. Each needs an understandable setup, readable motion and sound, an opportunity to intervene, and consequences consistent with the survival rules. A stranger watching a short clip should understand the goal and the mistake without seeing a menu or knowing the progression tree.

### Character and communication

- Keep distinctive prospectors with oversized hands, expressive head/eye poses, readable injury reactions and dropped hats. Look direction and visible carried equipment should help teammates interpret intent.
- Make temporary ragdolls and rescue poses visible to everyone. Apply authoritative motion and impacts to a simple body proxy; the limbs and hat can use cheaper cosmetic animation.
- Add opt-in proximity voice as a target feature, with distance attenuation, localized machine noise and short voice filters tied to physical situations such as a bucket over the head. Microphone refusal must leave text chat and all gameplay usable.
- Use the existing host for WebRTC signaling. Internet voice requires configurable ICE/STUN/TURN support and separate connectivity verification; do not claim voice works everywhere from a localhost check. A disconnected voice connection must not disconnect the player.
- Ensure core physical comedy works without voice, so communication amplifies the interactions rather than concealing missing mechanics.

### Consequences and multiplayer rules

- Gold-bearing spilled cargo remains in a bounded recoverable pile with its exact mass and contained gold. Breaking or tipping a container must not duplicate or erase its contents.
- A temporary tumble is distinct from death. Severe warned accidents can cause injury or death; death loses carried recovered gold and leaves tools/cargo for recovery, as selected for the expanded campaign.
- Big machines retain useful controls, brakes and accessible stops. Routine use should be reliable; overload, speed, pressure and risky positioning create understandable failures.
- Both players must observe the same authoritative object state, impact, tumble and recovery. Replicate gameplay outcomes and interpolate presentation; do not simulate independent gameplay ragdolls on each client.
- Limit active physical objects near players. Represent bulk gravel as parcels and stockpiles with cosmetic particles, rather than networking every pebble. Scale test scenes to eight players.
- Preserve earned automation: safe engineered layouts should run reliably. As jobs become automated, comedy moves toward expansion, repairs, new deposits and larger recovery attempts instead of compulsory random failures in established equipment.

### First implementation gate

Before enlarging the world or building the complete machine catalog, implement one reusable co-op scene: dig gravel, physically load and push a wheelbarrow down a slope, recover a spilled load, and help a fallen teammate. Include both ordinary safe operation and player-caused overloading. This establishes cargo physics, character reactions and rescue interactions that later equipment can reuse.

Validate with two human players in an unprompted 10-15 minute session, plus controlled browser checks of tipping, spilling, grabbing, recovering and reconnecting. Look for spontaneous laughter, a retellable mishap, understandable blame, and a recovery players can complete. Those observations validate the design direction; they cannot guarantee virality. Do not label scripted test-hook events or rendered emotes as a completed co-op comedy playtest.

The final machines should retain the same underlying chain: excavate -> haul -> screen -> wash -> collect. Increase their scale, noise and awkwardness while preserving clear improvements in capacity. Humor should come from how players use that equipment together.

## Suggested next builds

1. **Human playtest:** two complete sessions in Gold Rush mode. Tune gold traces, useful sample feedback, panning time and first upgrade cost.
2. **Early cooperation:** physical wheelbarrow, bulk rocker loading, shared sample stakes and a small horse cart.
3. **Waterworks:** place pipes/flumes, source pumps, reservoir capacity, water pressure and a historical hydraulic monitor.
4. **Industrial claim:** operating costs, better roads, dumping piles, conveyors and mechanically animated excavator buckets.
5. **Geology and terrain:** more readable layers, bedrock crevices, buried channels and deeper deposits. The 0.6 bounded voxel claim now provides real tunnels; expand its geology and survey feedback next.
6. **Unreal vertical slice:** preserve the prospecting, recovery, inventory and crew economy contracts; rebuild the renderer, movement, terrain and replication in the engine.


## Version 0.6 — player-built mines

Implemented: a bounded true 3D mine claim with persistent player-cut branches, removable floors/ceilings, a central ladder shaft, purchasable shaft extensions, snap-grid tracks, 240kg carts and a cart cage hoist. Its manual crank can be operated alone from inside; the steam upgrade continues to the next landing. Calling the cage, recovering an orphaned cart and sequential processing keep the solo path viable. Co-op players can share tasks while the same terrain edits and cargo replicate for up to eight miners.

The progression now has a mine logistics branch: creek samples and panning -> profitable claim -> rail bundles and carts -> manual cage hoist -> deeper shaft levels -> steam lifting, connected to existing surface washing equipment. Ore crushing, autonomous cart dispatch, conveyors, supports/cave-ins and ventilation remain planned. This prototype uses the shovel for rock excavation; later pickaxes/drills should distinguish hard-rock extraction and crushing from creek gravel. See MINE-GUIDE.md and ARCHITECTURE.md for current capabilities and bounds.

## Continuous mine excavation (0.7)

Aim direction shapes real excavation: level galleries, diagonal ramps and downward shafts. Rounded walls use continuous density cuts rather than cube removal. A hand shovel removes a stylized bounded parcel (at most 12kg) per cut; the geometric opening is deliberately forgiving for traversal. Widen passages for level rail construction. Personal shafts need a purchased rope anchored before excavation; solo climbing is available without a second operator. World depth remains 38m in the current claim.

## Wood and structural mining (0.8)

Wood is earned through trees, not a shop button. A tree yields six logs; four build one support. Frames roughly every four metres give a solo miner enough time to excavate and brace while a crew can split forestry, digging, building and hauling. Cracks at 45 seconds and danger at 70 telegraph the 90-second cave-in. Recoverable rubble creates a setback and an escape moment without needing another player to rescue you. Initial landings are safe and offline danger freezes.

## Hand excavation progression (0.9)

The starter shovel remains usable for mines. A miner’s pick is an accessible $65 first step; a $210 pick-mattock and $620 heavy tunnelling pick progressively broaden/lengthen true cuts, shorten swings and lower mouse effort. Every tier needs personal ownership of the previous pick. Press 4 for the best purchased pick, 1 for the surface shovel. Heavy 24kg loads push players toward carts and improved hauling; faster expansion still needs wood supports. The large reinforced head starts the goofy visual escalation while keeping hand tools recognisable. Prices and mouse feel are provisional and need human playtesting.


## Goofy mouse-operated excavator (0.10)

The Rustbucket now extends the physical shovel loop: position real teeth, plant, pull up to scoop, then swing and release to dump. Four articulated joints replace the canned dig swing. Springs overshoot slightly and respond more slowly under load; the cab reacts to slewing. C lets the miner curl the bucket separately, wheel folds the stick, and Shift allows multiple scoops. A slow release pours into a receiver; a flick launches paydirt, leaving recoverable mess when the crew misses. Solo players can position a truck and load it sequentially, with E preserved as a convenient shortcut. Co-op spectators receive joint motion and flying cargo. Tree strikes, vehicle impacts, excavator mining underground and fully simulated hydraulic loads are further work.


## Difficulty preference and first automation/comedy pass (0.11)

The user explicitly wants demanding multi-mode hand and vehicle controls. Preserve that difficulty. Their requested priorities are physical feedback, upgrades that take over jobs, and interacting accidents. A rocker motor now replaces the hand-crank job, and a feeder removes serial bucket trips after a load is dumped at its inlet. Both use the existing shared purchasing/placement economy. Feeding faster than processing builds a visible backlog; a misaligned belt drops recoverable dirt rather than crediting a hidden transfer.

The immediate scenario is: park the barrow, dump a pile at the hopper, let the belt feed the washer, and return to mining. An overloaded hopper or backed-up outlet produces a readable jam. Someone holds H to clear it; the resulting messy discharge can muddy a nearby face and still leaves the paydirt recoverable. With two players, one clears while the other digs or fixes the outlet; alone, the player stops and performs those jobs sequentially. H can also catch a released runaway cart. These mechanics create opportunities for accidents and rescue; automated coverage does not establish human enjoyment or viral potential. Long sessions and economic progression still need human tuning.
