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

## Considered, not kept

Candidates from the dig review came from these CC0 packs. Get the packs from their pages if you need them again.

- [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds): snow, grass, soft thud, mining
- [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio): dirt footsteps, chop, other door-close takes (`doorClose_2`–`4`, not yet auditioned)
- [Different Steps by kdd](https://opengameart.org/content/different-steps-on-wood-stone-leaves-gravel-and-mud): mud and gravel
