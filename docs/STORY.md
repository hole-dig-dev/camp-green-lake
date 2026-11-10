# STORY BIBLE: "DRYWATER" (replaces every borrowing from the book/film *Holes*)

Why: the game is headed for Steam. Camp Green Lake, Stanley, Zero, the Warden, Mr. Sir, Mr. Pendanski, the D Tent
nicknames, Kissin' Kate Barlow, Sam and his onions, Madame Zeroni and her curse, yellow-spotted lizards, Sploosh,
God's/Big Thumb, "There is no lake at Camp Green Lake" are all Louis Sachar's. None of them may remain in anything a
player can see or hear. A dried lake with gold under it, a work camp, a quota, lizards and curfew are fine: those
are premises, not his expression.

## The new premise (keep the tone: dry, deadpan, a little absurd; co-op comedy first)

**DRYWATER** (title). Tagline: **"The water's gone. The gold isn't."**

Lake Drywater dried up forty years ago. Last spring somebody found gold in the mud, and the Drywater Reclamation
Company fenced the shore, put up a camp and started hiring. You are a **digger**: you signed the contract without
reading it, and you owe the Company for the bus ride, the bunk and the shovel you have not bought yet. Every night
at lights-out the Company takes **its cut** from the crew's wallet. Miss the cut and the whole crew is **let go**
(the run restarts). Nobody has ever paid off the contract. There is no way out past the fence line worth walking to.

The old story under the lake: before it dried, the lake drowned the town of **Marlow's Landing**. A riverboat
gambler and bank robber, **"Lucky" Lil Marlow**, sank her strongbox in the lake in 1887 rather than give it up. The
buried town and her loot are still down there. The lake is said to be unlucky since ("Lil's luck").

## Rename table (visible text only; see the rules below)

| Old (Holes) | New |
|---|---|
| Camp Green Lake / Green Lake | Camp Drywater / Lake Drywater (the game title is DRYWATER) |
| "There is no lake. Only holes." | "The water's gone. The gold isn't." |
| camper(s) | digger(s) |
| the Warden (she) | the Superintendent (she; "the Super" in short lines) |
| Mr. Sir | Foreman Dutch ("Dutch") |
| Mr. Pendanski ("Mom") | Mr. Abel, the Company clerk ("the clerk") |
| Supply Depot | Company Store |
| D Tent (and A/B/C tents) | Bunk D (Bunk A, B, C) |
| X-Ray, Armpit, Squid, Zigzag, Magnet, Zero | Rivet, Biscuit, Moth, Tin Cup, Sparks, Half-Pint (same order, same personalities loosely) |
| title-screen nickname list (Caveman, Sploosh, Big Thumb, Onion Boy, Lizard Bait, Seeds, Barf Bag, Twitch, Theodore, Sweet Feet) | Dusty, Blisters, Two Scoops, Mudcat, Lizard Bait, Pockets, Sunburn, Twitch, Shovelhead, Sweet Feet |
| Stanley / Yelnats / Caveman as a character | remove, or "the new digger" |
| quota (the Warden's quota) | the Company's cut ("the cut"); code names stay |
| fired | let go |
| curfew | lights-out (the siren is still a siren; "curfew" may stay where it is a plain word, but prefer lights-out) |
| yellow-spotted lizard(s) | gold-eyed gila(s) ("gilas"); bite still deadly-ish |
| onion(s) (heal, repel lizards; Sam's onions) | bitterroot (a bitterroot / chew bitterroot); "Sam" is gone |
| Sploosh / jar of Sploosh / jug of Sploosh | peach shine / jar of peach shine / jug of peach shine |
| Kissin' Kate Barlow / Kate / KB | "Lucky" Lil Marlow / Lil / LM |
| the KB tube (gold lipstick tube marked KB) | the LM card case (a gold card case engraved LM) |
| Kate's suitcase / Stanley Yelnats' suitcase | Lil's strongbox |
| the Sheriff / Trout Walker / Walker Ranch | the Marshal / Cobb / the Cobb place |
| Madame Zeroni, her curse, "Zeroni" | the Drowned Bride (she walks the lake at night); "the curse" becomes "Lil's luck" or "bad luck"; the curse meter is "Bad luck" |
| God's Thumb / Big Thumb | the Chimney (Chimney Rock) |
| the buried town / old Green Lake town | Marlow's Landing |
| Clyde Livingston's sneakers / "Sweet Feet" lore | drop the lore; a pair of old boots if an item needs to exist |
| "dig a hole five feet deep and five feet wide" style lines, "to build character" | remove or rewrite in the Company's voice ("Dig. The Company thanks you.") |
| Employee of the Day | keep (it is the Company's) |

Anything else you find that is recognisably from *Holes* (quotes, the palindrome name, "If only, if only", the
warden's rattlesnake-venom nail polish, peaches, "I can fix that", Camp Green Lake Juvenile Correctional...) gets
the same treatment: replace with something in the Company's deadpan voice, or delete.

## Rules for applying it

1. **Visible and audible text only**: strings shown in the HUD, toasts, dialogue, store, signs, title, pause menu,
   console help, README player-facing parts, HTML title/meta, alt text, and text baked into models/signs (see 4).
   **Do not rename identifiers**: variable and function names, object keys used as ids (`sploosh`, `onions`, `zeroT`,
   `S.hasKB`, `warden`, `sir`), network message fields, save keys, file names, model file names, CSS ids, tune keys,
   log event names. Renaming those breaks saves, the server and Greg's branches. A comment may mention the old name
   once where an id no longer matches its label (e.g. `// 'onions' is the id; players see "bitterroot"`).
2. Keep each line's meaning, length and humour. Do not add lore dumps. Where the old line was a *Holes* quote or
   in-joke, write a new line in the Company's voice.
3. Grammar: "a onion" style leftovers are bugs. Check plurals, articles and capitalisation ("the Superintendent",
   "Foreman Dutch", "the Company").
4. Text on 3D signs and boards: find how each sign gets its text (canvas textures in JS, or baked in Blender scripts
   under art/blender/). JS-drawn text: change it. Baked text (e.g. a GLB sign that reads CAMP GREEN LAKE or
   "YELLOW-SPOTTED LIZARDS"): change the Blender script and re-export only if the script runs cleanly in
   `~/blender/blender -b`; otherwise list every baked sign you could not change in your report.
5. Tests: some tests assert on visible text or nicknames. Update the expectations to the new text; never weaken a
   check. Chat/voice/security code that filters names must keep working.
6. Docs: do not rewrite the history in docs/ (HANDOFF, plans, claude-to-claude). Add docs/STORY.md containing this
   bible so future work stays on-setting, and update the README's first paragraph and CLAUDE.md's one-line
   description of the game.

## Notes from the pass that applied this (2026-11-10)

- **The crew kept JT's names.** The table above maps the *Holes* nicknames to Rivet, Biscuit, Moth, Tin Cup, Sparks and
  Half-Pint, but JT had already renamed the crew on 2026-10-01 to **Jim Bob, Randy, Stan, Pete, Larry and Zach**
  (`public/sim.js` CREW, `public/js/30-npcs.js` BOTDEF). Those are not from the book, so they stay; their lines that
  echoed the book were rewritten. If the nicknames above are wanted after all, change the names in those two places,
  in `80-ui.js` BOT_TALK and the tests, and add the old names to the rename map in `server.js` (where the 2026-10-01
  rename already carries each crew member's kit across).
- **Display names chosen where the table was silent:** `strongbox` (the ordinary heavy find) is the "Old bank
  cashbox", so that "Lil's strongbox" is only the prize (`suitcase`); the jar and crate are "brandied peaches"; the
  boots that fall from the sky are a "Pair of old boots"; the town's buildings are the Marshal's office, the Boat
  shed, Lil's house, the Root cellar and Lil's vault; the lullaby is four new lines (`73-emotes.js`); the Drowned
  Bride is looking for her ring.
- **Ids that no longer match their label** (never rename them): `kb`/`S.hasKB` = the LM card case, `suitcase` = Lil's
  strongbox, `strongbox` = the cashbox, `sploosh` = peach shine, `onion`/`S.onions` = bitterroot, `warden` = the
  Superintendent, `sir` = Foreman Dutch, `sheriff` = the Marshal's ghost, `kate` = Lil Marlow's ghost, `zeroni`/`zer` =
  the Drowned Bride, `curse` = bad luck ("Lil's luck"), `quota` = the Company's cut, `fired` = let go, `curfew` =
  lights-out, `lizard`/`liz` = gila, `clerk` = Mr. Abel, `D_TENT` = Bunk D, `SignBigThumb` = the Chimney Rock sign,
  the `tune` keys (`curse.*`, `curfew.*`, `dmg.Lizard hatchling`), the console commands `curse`, `tent` and `roster
  sir|sheriff|warden|kate`, model file names (`WardenHouse.glb`, `MrSirTruck.glb`, `KBTube.glb`...).
- **Lettering baked into models** is swapped by `art/blender/story_retext.py` (it lists what it changed and what it
  could not).
