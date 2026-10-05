# Asset catalog

Status meanings and rules are in the [README](README.md). Verdicts come from JT's listening review on September 28, 2026. Source and license details for shipped recordings are in the [sound inventory](../docs/audio-inventory.md#recording-sources-and-license); every recording here is CC0.

## Audio in the game

| Asset | Status | File | Notes |
| --- | --- | --- | --- |
| Wind (original, synthesized) | In game: approved | code in `public/js/40-fx.js` | JT prefers it over the recorded wind (`public/audio/wind.mp3`), which remains available as the A/B option |
| Rain | In game: approved | `public/audio/rain.mp3` | Recording beat the synthesized rain |
| Metal click | In game: approved | `public/audio/metalClick.mp3` | Recording beat the synthesized tone |
| Digging, four-way rotation | In game: approved | `public/audio/dig-shovel-sand-l1.mp3`, `-r1`, `-l3`, `-r3` | Shovel layered with a sand step; played in turn. Picked in dig review round 3 |
| Crickets (night) | In game: approved | `public/audio/crickets.mp3` | "Good addition for night" |
| Footsteps, sand and stone | In game: approved | `public/audio/step-sand-1..3.mp3`, `step-stone-1..3.mp3` | "Don't change" |
| Tent cloth | In game: approved | `public/audio/cloth1.mp3` | |
| House door open | In game: approved | `public/audio/doorOpen_1.mp3` | Also plays, slightly lower, when leaving the house |
| Tumbleweed gust (synthesized) | In game: approved | code in `public/js/40-fx.js` | |
| Desert 1: hawk | In game: approved | `public/audio/call-hawk.mp3` | Day. Noise-reduced; the uncleaned cut is `audio/desert-calls/call-hawk-before-cleanup.mp3`. [R30-34 Red Tailed Hawk by craigsmith](https://freesound.org/people/craigsmith/sounds/479610/), CC0 |
| Desert 7: coyotes, distant | In game: approved | `public/audio/call-coyotes-distant.mp3` | Night. Noise-reduced; the uncleaned cut is `audio/desert-calls/call-coyotes-distant-before-cleanup.mp3`. [Coyotes, distant howls and barks by TRP](https://freesound.org/people/TRP/sounds/616994/), CC0 |
| Desert 9: coyotes, near | In game: approved | `public/audio/call-coyotes-near.mp3` | Night. Noise-reduced; the uncleaned cut is `audio/desert-calls/call-coyotes-near-before-cleanup.mp3`. [coyote barks and howls by dkaufman](https://freesound.org/people/dkaufman/sounds/256533/), CC0 |
| Desert 10: owl | In game: approved | `public/audio/call-owl.mp3` | Night. Noise-reduced; the uncleaned cut is `audio/desert-calls/call-owl-before-cleanup.mp3`. [Owl Hoot by Breviceps](https://freesound.org/people/Breviceps/sounds/465697/), CC0 |
| Desert 11: dove | In game: approved | `public/audio/call-dove.mp3` | Morning. Noise-reduced; the uncleaned cut is `audio/desert-calls/call-dove-before-cleanup.mp3`. [mourning_dove by nathankwright](https://freesound.org/people/nathankwright/sounds/456930/), CC0 |
| Shovel (bare) | In game: not reviewed | `public/audio/shovel.mp3` | Now only the loading fallback for the dig rotation, and a layer inside it |
| Birds (day) | Off (level 0) | `public/audio/birds.mp3` | JT: the always-on day loop was too much. The file stays; `BIRDS_LEVEL` in `public/js/40-fx.js` is 0. An occasional call might return later |
| Bunk cloth | In game: not reviewed | `public/audio/cloth2.mp3` | |
| Recorded wind | In game: not reviewed | `public/audio/wind.mp3` | A/B option only (`audio wind new`) |
| Hazards, wildlife, patrol, Zeroni, game cues, disco | In game: not reviewed | code in `public/js/` | JT: most still sound code-generated; not a priority yet |

## Digging variants (liked)

The numbers match round 2 of the dig review. The game rotates all four.

| Variant | Status | File | Mix |
| --- | --- | --- | --- |
| #2 | Liked, in rotation | `audio/dig/variant-2-shovel-sand-L1.mp3` | Shovel + Fantozzi SandL1 |
| #3 | Liked, in rotation | `audio/dig/variant-3-shovel-sand-R1.mp3` | Shovel + Fantozzi SandR1 |
| #4 | Liked, in rotation | `audio/dig/variant-4-shovel-sand-L3.mp3` | Shovel + Fantozzi SandL3 |
| #5 | Liked, in rotation | `audio/dig/variant-5-shovel-sand-R3.mp3` | Shovel + Fantozzi SandR3 |

## Sources

| File | Status | From | License |
| --- | --- | --- | --- |
| `audio/sources/shovel-themightyglider.ogg` | Source | [Shovel Sound by themightyglider](https://opengameart.org/content/shovel-sound) (full length; `shovel.mp3` is trimmed) | CC0 |
| `audio/sources/Fantozzi-SandL1.ogg`, `SandR1`, `SandL3`, `SandR3` | Source | [Fantozzi's Footsteps](https://opengameart.org/content/fantozzis-footsteps-grasssand-stone) | CC0 |

## Models, kept, not used

| Asset | Status | File | Notes |
| --- | --- | --- | --- |
| Pines 01–10 (Ponderosa, Lodgepole, Young pine, Dense mountain pine, Windswept, Old twin, Half-dead, Dead snag, Pinyon, Lightning-struck), each with a far version | Kept, not used | `models/pines/pine-NN.glb`, `pine-NN-far.glb`; preview `models/pines/pines-sheet.jpg` | Gold Fever. Original work: Sol (GPT-6.1) built them procedurally in Blender on Oct 5, 2026 (`models/pines/source/pines.py`, `pines.blend`, `PINES-REPORT.md`). Real heights 4–12 m, glTF +Y up, origin at the trunk base, materials `PineBark` / `PineNeedles`, colour in vertex colours (COLOR_0); 1.5k–4.4k triangles near, ≤ 800 far. JT, after seeing them in the forest: "Just keep them in the asset library." The game keeps the Quaternius pines. The forest wiring that used them is on branch `feature/sol-pines` (`gold-fever/public/forest-view.mjs`). Note: `pines.py` exports to `gold-fever/public/assets/trees/`; copy here instead when rebuilding for the library. Seen in game: chunkier and darker than the Quaternius pines, and the pinyon reads like an acacia |

## Retired

| File | Retired | Why |
| --- | --- | --- |
| `audio/retired/doorClose_1.mp3` | September 28, 2026 | JT: "door close not good." Leaving the house now replays the door-open clip. From [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio), CC0 |

## Review reels

| File | What it is |
| --- | --- |
| `audio/review-reels/2026-09-28-full-reel-labeled.mp3` and [its map](audio/review-reels/2026-09-28-full-reel-labeled.md) | All 56 game sounds, each named before it plays, with the four A/B pairs first |
| `audio/review-reels/2026-09-28-dig-round1-18-candidates.mp3` | Current shovel + 18 single-sound candidates |
| `audio/review-reels/2026-09-28-dig-round2-20-layered.mp3` | 20 shovel-layered variants. JT liked #2–#5 |
| `audio/review-reels/2026-09-28-dig-round3-focus-2-5.mp3` | #2–#5 alone, then all four rotating. JT picked the rotation |
| `audio/review-reels/2026-09-28-desert-round1-15-candidates.mp3` | 15 CC0 desert one-shots. JT picked 1, 7, 9, 10, 11 |
| `audio/review-reels/2026-09-28-desert-calls-cleanup-before-after.mp3` | The five picks before and after noise reduction |

## Considered, not kept

- Desert round 1, not picked: two more hawk takes, three raven takes, closer coyote howls, three wind gusts, a rattlesnake (Freesound CC0; see the round-1 reel).

Candidates from the dig review came from these CC0 packs. Get the packs from their pages if you need them again.

- [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds): snow, grass, soft thud, mining
- [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio): dirt footsteps, chop, other door-close takes (`doorClose_2`–`4`, not yet auditioned)
- [Different Steps by kdd](https://opengameart.org/content/different-steps-on-wood-stone-leaves-gravel-and-mud): mud and gravel
