# CAMP GREEN LAKE — MASTER GAME DESIGN / IMPLEMENTATION BRIEF

You are helping me redesign and implement my multiplayer browser game.

Before changing code:

1. Inspect the existing project and understand what already works.
2. Preserve useful existing systems instead of rebuilding them unnecessarily.
3. Read this entire design brief before making architectural decisions.
4. Treat the design principles below as more important than individual feature examples.
5. Implement the game in playable vertical slices. Do not attempt every feature simultaneously.
6. Whenever you implement something, ask: **does this create funny cooperative physical situations between friends?**

---

# 1. THE GAME

This is a 1–8 player cooperative horror-comedy extraction game inspired structurally by:

- R.E.P.O.
- Lethal Company
- PEAK

The setting is Camp Green Lake / a cursed desert juvenile labor camp.

Players are campers serving a sentence by digging for valuable objects for the Warden.

The game's identity is NOT simply:

"Dig for treasure."

It is:

> **Dig farther down than you probably should, find something stupidly valuable, then figure out how to physically get the treasure AND your friends back out before extraction leaves.**

The game should produce chaotic stories naturally through physics and cooperation.

Example of the intended experience:

> Four players dig through the roof of a buried building.
> Someone falls into the basement.
> They discover a huge safe worth most of the quota.
> Three players try to rope it upward.
> The rope slips.
> The safe knocks someone unconscious.
> The truck horn sounds.
> They abandon smaller loot, drag their injured friend upward, somehow get the safe into the truck, and jump aboard as it begins leaving.

That is the game.

---

# 2. THE CORE DESIGN PRINCIPLE

The objective creates pressure.

The physics create comedy.

The friends create the content.

Players should genuinely be trying to cooperate.

Do NOT design the game primarily around intentional griefing.

The ideal comedy is:

> "I was trying to help."

Players should constantly say things like:

- HOLD IT
- PULL ME UP
- CATCH THIS
- DON'T DROP THAT
- GET THE ROPE
- DIG ME OUT
- HELP ME CARRY THIS
- THE TRUCK IS LEAVING
- LEAVE IT
- NO, WE CAN GET IT

If multiplayer mostly sounds like:

> "I'm digging here."
> "Okay."

then the design has failed.

---

# 3. CORE PLAYER VERBS

The core interaction vocabulary should stay understandable:

- grab
- carry
- drag
- push
- pull
- throw
- catch
- climb
- boost another player
- dig
- lower with rope
- pull upward
- anchor
- revive
- carry an unconscious player

These simple mechanics should combine with each other.

We want systemic interactions rather than dozens of unrelated minigames.

---

# 4. MAIN GAME LOOP

The high-level loop is:

CAMP
↓
CHOOSE DIG SITE
↓
PREPARE EQUIPMENT
↓
RIDE MR. SIR'S TRUCK
↓
ENTER TIMED MISSION
↓
EXPLORE
↓
DIG / EXCAVATE
↓
FIND VALUABLE OBJECTS
↓
DECIDE WHETHER TO GO DEEPER
↓
PHYSICALLY EXTRACT LOOT
↓
ESCAPE BACK TO TRUCK
↓
LOAD LOOT AND PLAYERS
↓
TRUCK LEAVES
↓
RETURN TO CAMP
↓
SELL / BUY / PLAN
↓
NEXT MISSION

The player should almost always understand the simple objective:

> **Get enough valuable stuff onto the truck and make it back alive.**

Everything else exists to complicate that task.

---

# 5. THE HUB

Camp Green Lake is a small safe hub.

It is NOT another large open-world area.

Important locations:

### Warden's Office
Choose currently available dig sites.

### Quota Board
Shows the crew's current quota and remaining trips.

### Wreck Room / Shop
Buy equipment and run upgrades.

### Bunks
Social / cosmetic area.

### Truck Yard
Load equipment and begin missions.

The hub should be fast.

Players should naturally have conversations such as:

> "We're 400 short."
> "Let's do Ghost Town."
> "Absolutely not."

---

# 6. THE TRUCK

Mr. Sir's water truck serves the same structural purpose as the ship/extraction vehicle in an extraction game.

It should be physical.

Loot only counts if it reaches the truck.

Players need to physically reach the truck as well.

Suggested extraction escalation:

- 3 minutes: first distant horn
- 1 minute: engine starts
- 30 seconds: repeated horn
- 10 seconds: truck begins moving slowly

Players should be able to:

- throw loot aboard
- carry bodies aboard
- climb onto the truck
- barely catch the truck
- leave people or valuables behind

The final seconds of missions should regularly become chaotic.

---

# 7. RUN STRUCTURE

One complete successful "sentence" should roughly take 60–100 minutes.

The game should be replayable for many runs rather than being a 6-hour linear campaign.

A run consists of several quota cycles. Example:

### Quota 1
Low requirement. Learn the run. Basic locations.

### Quota 2
Higher requirement. More dangerous sites become attractive.

### Quota 3
High requirement. Players deliberately gamble the run by entering dangerous areas.

### Finale
Big Thumb becomes available. The normal quota gameplay transforms into a final cooperative expedition.

---

# 8. FAILURE

This is extremely important.

If the ENTIRE crew is lost:

> THE SENTENCE FAILS.

The whole run resets. Run-specific progression is lost:

- current quota
- seeds / money
- equipment purchased during the run
- run upgrades
- current site unlock progress
- curse state
- artifacts
- progress toward finale

However:

### If even ONE camper successfully returns/extracts:
the sentence continues.

This creates last-survivor moments and heroic sacrifices.

Individual death should therefore usually have intermediate states:

Healthy → Downed / unconscious → Lost / dead

A downed player becomes a physical logistics problem. Friends can:

- drag them
- carry them
- put them in a cart
- throw them onto the truck
- abandon treasure to save them

Death should create gameplay.

---

# 9. QUOTA SYSTEM

Use escalating shared quotas. A good structure is approximately 3 expeditions per quota deadline.

The crew chooses where to spend those trips.

Safer locations: lower expected value, easier terrain, less danger.

Dangerous locations: expensive / difficult, much higher potential value.

This should produce conversations like:

> "We're 300 short."
> "The Flats probably won't cover it."
> "...Buried Town?"

The farther the crew is into a run, the more they have to lose. This naturally creates tension.

---

# 10. LEVEL ACCESS

Do NOT give players every location immediately.

Sites become discovered/unlocked during the sentence. Old discovered sites remain available.

This creates expanding player choice rather than a purely linear campaign.

Example progression:

- Start: Lake Flats
- Early: Ghost Town / other nearby site
- Mid: Buried Town
- Later: Onion Canyon
- Final: Big Thumb

Some sites can be discovered physically. Example: players excavate an old tunnel or map fragment. At the end of the mission:

NEW DIG SITE DISCOVERED: BURIED TOWN

This connects exploration to campaign progression.

---

# 11. LEVEL DESIGN PHILOSOPHY

A new level should NOT merely mean different textures, a different enemy, or more enemy damage.

Each location introduces a new COOPERATION PROBLEM.

The levels teach increasingly difficult forms of physical teamwork.

---

# 12. SITE 1 — LAKE FLATS

Main lesson: **OBJECT HANDLING**

Relatively open terrain. Players learn:

- digging
- carrying
- dragging
- throwing
- carts
- basic treasure
- reviving
- getting back to truck

Simple physical mistakes should already be funny here.

If this level is boring without lots of monsters, the core mechanics need more work.

---

# 13. SITE 2 — GHOST TOWN

Main lesson: **EXTRACTION GEOMETRY**

Collapsed buildings. Doors. Windows. Basements. Weak floors. Awkward interior spaces.

Now the question becomes:

> "How do we get this enormous object OUT of the building?"

Examples:

- piano does not fit through door
- mirror is fragile
- safe requires several players
- floor collapses under heavy objects

Players may need to:

- remove walls
- use windows
- make improvised ramps
- lower objects through floors

---

# 14. SITE 3 — BURIED TOWN

This should be one of the game's signature locations.

Main lesson: **DEPTH / EXCAVATION**

The dungeon is buried underneath the player. Players excavate INTO it.

Possible vertical layers:

Surface → Buried rooftops → Old buildings → Underground streets → Basements → Wells / tunnels / hidden chambers

Players can create their own routes by digging.

Digging badly can:

- collapse terrain
- drop players into rooms
- destroy useful paths
- create shortcuts
- trap loot

The deeper players go:

- the better the expected loot
- the harder getting back becomes
- the greater the temptation to continue

The key phrase we want players to say:

> "One more layer."

---

# 15. DIGGING DESIGN

Digging must NOT feel like Minecraft.

Do not design around spending long periods destroying hundreds of terrain blocks.

Digging exists primarily to:

- reveal locations
- create shortcuts
- create holes
- expose buildings
- create ramps
- uncover treasure
- change traversal

Think:

> **excavation as temporary level editing under pressure**

rather than voxel survival crafting.

Players can receive clues about valuable areas:

- cracks
- dirt mounds
- detector signals
- maps
- exposed structures
- sounds

But avoid turning everything into "go to glowing X and hold Dig."

Players should choose HOW to excavate.

---

# 16. DEPTH = GREED

Depth should be a risk/reward system.

Players should often reach a point where they already have enough reasonable loot.

Then they detect something below. They choose whether to continue.

Example: the crew has enough to probably satisfy quota. The metal detector produces a huge signal underneath them. They say:

> "One more floor."

They break through. They discover something extremely valuable. Now they're 40 meters underground with only minutes remaining.

This is one of the game's central emotional loops.

---

# 17. SITE 4 — ONION CANYON

Main lesson: **TRANSPORTATION ACROSS EXTREME TERRAIN**

Features: cliffs, slopes, ravines, spring, brush, unstable paths.

Players increasingly rely on: ropes, lowering, pulling, catching, anchoring, carts, player boosting.

Objects can:

- roll downhill
- fall into ravines
- become stuck
- drag players with them

This level should strongly evoke the cooperative traversal tension of PEAK while remaining focused on transporting loot.

---

# 18. SITE 5 — BIG THUMB

The finale. Normal quota rules stop.

The final objective becomes:

> Carry Madame Zeroni to the summit and break the curse.

The final mission tests everything learned: carrying, ropes, stamina, traversal, reviving, route planning, saving friends, hauling a person, improvisation.

The terrain should become increasingly dangerous. The lake may begin flooding. Rain turns earlier excavations into channels. Low areas become inaccessible. The crew must move UP.

The whole game's progression therefore has a satisfying shape:

learn to move objects → learn architecture → learn to descend → learn extreme traversal → final massive ascent

---

# 19. TREASURE DESIGN

Treasure should NOT primarily be: pick up item → +50 money.

Treasure itself should create gameplay.

Important physical properties: heavy, large, fragile, long, noisy, unstable, rolling, moving/alive, dangerous if dropped.

Examples:

- **Giant Safe**: very valuable. Needs several players.
- **Antique Mirror**: large + fragile.
- **Piano**: heavy + awkward geometry.
- **Giant Fossil**: very long.
- **Dynamite Crate**: fragile + dangerous.
- **Strange Egg**: something may come looking for it.
- **Waterlogged Chest**: becomes heavier.
- **Huge Bell**: makes noise while being carried.

The ideal reaction when players uncover rare treasure is:

> "Oh no."

Finding treasure begins a new problem.

---

# 20. SOFT COOPERATION

Avoid rigid MMO-style roles.

Do NOT require "you need exactly three players to interact."

Instead:

- One player can drag a safe very slowly.
- Two can carry it.
- Three can move quickly.
- Four may be able to throw it or manipulate it creatively.

Friends make things faster, safer, funnier, and occasionally possible, rather than acting like arbitrary key requirements.

---

# 21. ROPES

Rope should be an important systemic tool.

Avoid making rope simply "Press E → ladder appears."

Possible uses:

- anchor to terrain
- lower player
- lower object
- pull player upward
- pull treasure upward
- tether player and object
- make improvised rescue
- pull several players together

Rope interactions should be physically capable of going wrong.

This should generate many cooperative situations from one tool.

---

# 22. EQUIPMENT

Equipment should primarily create NEW POSSIBILITIES.

Examples: long rope, winch, metal detector, large cart, ladder, harness, pulley, headlamp, explosive charge, straps, upgraded shovel.

Avoid relying too heavily on boring upgrades such as +15% strength or +20% stamina.

Small stat upgrades are acceptable, but the interesting progression should be new toys.

A good item makes players think:

> "Wait. We could do something really stupid with this."

---

# 23. MONSTERS

Monsters are NOT the primary gameplay. Do not turn the game into a shooter.

Enemies exist to disrupt logistics. Different enemy designs should create different problems:

- **Movement enemy**: forces players to abandon positions.
- **Separation enemy**: splits the group.
- **Noise-sensitive enemy**: makes carrying loud treasure dangerous.
- **Hole creature**: makes deep excavation dangerous.
- **Scavenger**: steals unattended tools/loot.

Enemies should interrupt player plans rather than replace them with traditional combat.

---

# 24. THE CURSE

The curse should NOT just be "Curse Level 4: +25% enemy damage."

The curse should act more like a run-specific director. Ideally it reacts to crew behavior. Examples:

- Players abandon teammates: voices / impersonators become common.
- Players repeatedly dig extremely deep: things begin coming upward.
- Players kill lots of wildlife: wildlife becomes increasingly hostile.
- Players hoard: fake treasure begins appearing.
- Players constantly lose tools: something begins stealing unattended equipment.

Each sentence should slowly develop its own personality. Players should say:

> "This run is completely cursed."

---

# 25. REPLAYABILITY

The game needs at least 6 hours of enjoyable replayability.

Do NOT achieve this by making one playthrough six hours long.

Replayability should come from combinations. Each expedition can vary:

- **Layout**: different entrances, buried structures, terrain and routes.
- **Loot**: different combinations of awkward treasure.
- **Threats**: different enemy combinations.
- **Conditions**: dust storm, heat wave, unstable ground, darkness, flooding, aggressive wildlife, abnormal curse.
- **Route**: different sites become attractive/discovered in different orders.
- **Equipment**: different crew loadouts create different strategies.

The player should not feel that replaying Ghost Town means replaying exactly the same Ghost Town.

---

# 26. RARE EVENTS

Eventually support rare events such as:

- truck breakdown
- huge treasure signal
- early rain
- alternate extraction location
- secret buried structure
- unusual nightfall
- extremely valuable artifact

These should generate: "Have you seen THAT event?"

Do not prioritize these before the core loop works.

---

# 27. SECRETS

The world should contain optional mysteries. Examples:

- strange buried symbols
- unreachable caves
- photographs
- hidden graves
- suspicious artifacts
- objects connected to Big Thumb
- alternate ways to affect the curse

Players should not fully understand the world after one successful sentence.

---

# 28. LONG-TERM PROGRESSION

Full team wipe resets the run.

Do NOT permanently increase players' power so much that physics becomes trivial.

Long-term unlocks can primarily include: cosmetics, titles, discovered lore, statistics, new starting choices, new equipment entering the loot/shop pool, new modifiers, secrets.

Run progression can be more powerful because it resets.

---

# 29. RELATION TO THE INSPIRATIONS

Do NOT clone these games mechanically. Use these references to understand the emotional targets.

### LETHAL COMPANY
Borrow: easy-to-understand objective, quota pressure, choosing expeditions, greed vs extraction, safe hub, final-second escape tension.
Our difference: terrain can be excavated; players create many of their own traversal problems.

### R.E.P.O.
Borrow: physical loot, awkward object manipulation, physics comedy, hauling things together, physical bodies, chaotic recoveries.
Our difference: objects frequently need to move vertically through player-created excavation routes.

### PEAK
Borrow: cooperative traversal, verticality, stamina tension, rescuing friends, "can we make it up there?" moments.
Our difference: traversal is tied to excavation and loot extraction; players often need to reverse terrain they descended through.

### OUR UNIQUE IDENTITY

> **R.E.P.O.-style physical loot taken downward into an excavation, followed by PEAK-style cooperative traversal back upward, under Lethal Company-style extraction pressure.**

The players partially created the terrain causing the problem.

---

# 30. THE TEST FOR EVERY FEATURE

Before adding something, evaluate it with:

> HOW DOES THIS MAKE FRIENDS NEED EACH OTHER IN A FUNNY WAY?

- A new terrain mechanic should create pulling, catching, carrying, boosting, climbing, route decisions.
- A new treasure should create transport problems.
- A new enemy should create rescue or disruption problems.
- A new tool should create new cooperative possibilities.
- A new curse effect should transform existing systems.

If it only increases a number, reconsider it.

---

# 31. WHAT NOT TO DO

Avoid:

- turning digging into Minecraft mining
- making every treasure a small inventory pickup
- making levels mostly about combat
- mandatory rigid class roles
- excessive stat progression
- glowing objective markers for everything
- overcomplicated objectives
- giving every location to players immediately
- long stretches where teammates work independently
- difficulty that is mostly enemy HP/damage increases
- scripted comedy instead of systemic comedy

---

# 32. IMPLEMENTATION PRIORITY

Do NOT build all locations before proving the core game.

## PHASE 1 — CORE VERTICAL SLICE

Build one ugly but functional Lake Flats mission. Required:

- multiplayer
- truck
- extraction timer
- physical loot
- heavy loot
- players helping carry
- basic digging
- one shallow underground area
- rope or equivalent rescue mechanic
- cart
- player downing / carrying
- loot only counts on truck
- one simple enemy
- success / failure
- return to hub

Do not prioritize visual polish yet.

### PHASE 1 SUCCESS TEST

Four players should be able to have a funny 10–15 minute mission even with almost no content.

They should naturally yell things like: pull, hold, catch, leave it, get him, truck, rope.

If not, improve interaction systems before adding more maps.

## PHASE 2 — DEPTH VERTICAL SLICE

Add a prototype Buried Town. Required:

- several vertical depth layers
- player-created entrances
- deeper = better treasure
- difficult upward extraction
- ropes
- collapses / terrain consequences
- one extremely valuable awkward object

The key question: does "one more layer" create genuine greed?

## PHASE 3 — RUN STRUCTURE

Only after Phases 1–2 feel fun, add: three-trip quota cycle, escalating quota, team-wipe sentence reset, site unlocking, mission selection, shop, run upgrades, persistent long-term cosmetic/lore progression.

## PHASE 4 — LEVEL VARIETY

Add Ghost Town, Onion Canyon, different terrain problems, more treasure properties, additional enemies, more equipment. Each new location must change cooperation, not just visuals.

## PHASE 5 — DYNAMIC RUNS

Add curse behavior, randomized conditions, randomized layouts where practical, rare events, secrets, mission modifiers.

## PHASE 6 — BIG THUMB

Build the finale last. It should use mechanics already proven elsewhere. Do not create a completely separate minigame. The finale combines carrying Zeroni, climbing, ropes, stamina, flooding, revives, teamwork, increasing vertical pressure.

---

# 33. HOW I WANT YOU TO WORK IN THE CODEBASE

First inspect the existing implementation. Tell me:

1. What systems already exist and can be reused.
2. What systems conflict with this design.
3. What the smallest viable Phase 1 implementation is.
4. Which files/modules would need major modification.
5. Which functionality should NOT be touched yet.

Then produce an implementation plan. Prioritize playable checkpoints.

Do not make a huge rewrite merely because the design changed.

Where possible, repurpose existing: carrying, heavy loot, stamina, revives, monsters, truck, quota, shop, buried town, onion fields, Big Thumb, curse, moods, lookout systems.

The goal is to transform the existing game into this loop incrementally.

---

# 34. FIRST DEVELOPMENT GOAL

The immediate target is NOT "Finish Camp Green Lake."

The immediate target is:

> **Make one 10–15 minute multiplayer expedition genuinely funny and tense because players need each other physically.**

Once that works, build the larger progression around it. When making implementation decisions, optimize for that first.

---

## Working notes

- Don't optimize for completing the feature checklist. The acceptance test is **player behavior**. "Rope implemented" isn't success. **Two friends yelling while trying to pull a safe and an unconscious camper out of a hole is success.**
- If development drifts (Minecraft-style mining, inventory-icon loot, combat-focused monsters): re-read sections 2, 15, 19, 29 and 30, then revise.
