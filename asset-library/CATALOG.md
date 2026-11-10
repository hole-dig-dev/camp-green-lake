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
| Core-loop cues, November 10, 2026: coin, nugget, find, assay, glint, pan wash, sifter, store, quota, level-up | In game: not reviewed | `public/audio/coin-1..3.mp3`, `coins-small.mp3`, `coins-pouch.mp3`, `ting.mp3`, `glass.mp3`, `bell.mp3`, `leather.mp3`, `latch.mp3`, `water-swirl-1..3.mp3`, `water-dunk.mp3`; code in `public/js/41-cues.js` | Chosen and mixed by measurement, not by ear. A/B with `audio rewards old|new`. Sources in the [sound inventory](../docs/audio-inventory.md#core-loop-sound-pass-november-10-2026-not-yet-reviewed-by-ear) |
| Menu sounds: open, close, hover, press, "can't afford" | In game: not reviewed | `public/audio/ui-open.mp3`, `ui-close.mp3`, `ui-hover.mp3`, `ui-click.mp3`, `ui-deny.mp3` | New; there were none. `audio ui old` turns them off |
| Hurt and knocked out | In game: not reviewed | `public/audio/hit-1.mp3`, `hit-2.mp3`, `bodyfall.mp3` | Replace the sine thud for damage; the knockout was silent. `audio danger old|new` |
| Curfew siren, lizard hiss (synthesized, redesigned), title start sting | In game: not reviewed | code in `public/js/41-cues.js` | Still Web Audio synthesis: no fitting CC0 recording |
| Other hazards, wildlife, patrol, Zeroni, remaining game cues, disco | In game: not reviewed | code in `public/js/` | JT: most still sound code-generated; not a priority yet |

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
| `audio/sources/core-loop/impact*.ogg` (10 files) | Source | [Impact Sounds by Kenney](https://kenney.nl/assets/impact-sounds) | CC0 |
| `audio/sources/core-loop/handleCoins.ogg`, `handleCoins2`, `handleSmallLeather`, `metalLatch`, `bookFlip2`, `bookClose` | Source | [RPG Audio by Kenney](https://kenney.nl/assets/rpg-audio) | CC0 |
| `audio/sources/core-loop/rollover2.ogg`, `click3.ogg` | Source | [UI Audio by Kenney](https://kenney.nl/assets/ui-audio) | CC0 |
| `audio/sources/core-loop/rubberduck-splash_04.ogg`, `_06`, `_13`, `_15` | Source | [40 CC0 water / splash / slime SFX by rubberduck](https://opengameart.org/content/40-cc0-water-splash-slime-sfx) | CC0 |
| `audio/core-loop/build.sh` | Build script | Turns the `sources/core-loop` originals into the shipped MP3s | |

## Retired

| File | Retired | Why |
| --- | --- | --- |
| `audio/retired/doorClose_1.mp3` | September 28, 2026 | JT: "door close not good." Leaving the house now replays the door-open clip. From [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio), CC0 |

## Review reels

| File | What it is |
| --- | --- |
| `audio/review-reels/2026-09-28-full-reel-labeled.mp3` and [its map](audio/review-reels/2026-09-28-full-reel-labeled.md) | All 56 game sounds, each named before it plays, with the four A/B pairs first |
| `audio/review-reels/2026-11-10-core-loop.mp3` and [its map](audio/review-reels/2026-11-10-core-loop.md) | The core-loop pass, recorded from the running game: each cue's old sound, then the new one. No spoken labels; the map has the times and measured levels. Not yet listened to |
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
