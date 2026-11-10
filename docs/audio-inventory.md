# Camp Drywater sound inventory

The game starts Web Audio on the player's first game-start click. Master volume controls everything; Effects controls recordings, ambience, and synthesized effects; Music controls the synthesized disco track; Voice controls live proximity chat. **M** mutes the master bus. Recordings load asynchronously, so the first use of a clip can play its synthesized fallback.

The **original synthesized wind remains the default**, because it already suits the lakebed. Other newly added recordings default on. To A/B at the same spot, open the developer console with backtick and use `audio wind old`, `audio wind new`, or `audio status`. `audio old` and `audio new` compare the whole soundscape. Categories are `wind`, `ambience` (birds/crickets), `rain`, `steps`, `dig`, `metal`, `props` (tent/house/bunk), and, since the November 10 core-loop pass below, `rewards`, `ui` and `danger`. These choices affect only your browser and reset on reload. The old game had no footsteps, birds, crickets, or tent/bunk Foley, so their "old" mode is silent.

## Listening review (September 28, 2026)

JT listened to the [labeled reel](../asset-library/audio/review-reels/2026-09-28-full-reel-labeled.mp3) and decided:

| Sound | Verdict | In the game |
| --- | --- | --- |
| Wind | Keep A, the original | Default stays `original` |
| Rain | B, the recording, is better | Default `recorded` |
| Metal | B, the recording, is better | Default `recorded` |
| Digging | Picked the four-way rotation of shovel + sand layers (review round 3) | Four `dig-shovel-sand-*` clips played in turn |
| Crickets | Good addition for night | Kept |
| Footsteps | Don't change | Kept |
| Tent cloth | Good | Kept |
| House door open | Good | Kept |
| House door close | Not good | Removed; leaving the house replays the door-open recording, slightly lower |
| Tumbleweed | Good | Kept |
| Birds (day loop) | Too much when always on | Off: `BIRDS_LEVEL` is 0; `birds.mp3` kept |
| Desert calls | Picked hawk, distant and near coyotes, owl, dove; clean up the background noise; play every 3–5 minutes by time of day | Five noise-reduced one-shots, one every 180–300 s from a random side |

Most later cues (hazards, wildlife, patrol, the Bride, game cues) still sound code-generated. They are not reviewed yet and are not a priority.

## Core-loop sound pass (November 10, 2026): NOT yet reviewed by ear

**Status: nobody has listened to these yet.** They were chosen and mixed by measurement (the author of this pass cannot hear), so every row below is "In game: not reviewed" until JT listens to the [review reel](../asset-library/audio/review-reels/2026-11-10-core-loop.mp3) ([order, timestamps and measured levels](../asset-library/audio/review-reels/2026-11-10-core-loop.md)). Nothing JT decided on September 28 was changed: wind, rain, metal, digging, crickets, footsteps, tent cloth, doors, tumbleweed, birds and desert calls are untouched.

The code is in `public/js/41-cues.js`. The recordings are CC0 one-shots played like a small sampler: a struck-metal "ting", a glass "tick" and a bell are re-pitched into short rising phrases, each with a small random detune, so a reward never plays at quite the same pitch twice. Until a clip has decoded, the old synthesized cue plays.

To compare in game, open the console with backtick: `audio rewards old`, `audio rewards new`, `audio ui old|new`, `audio danger old|new` (`audio old` / `audio new` switch everything). "Old" is the previous synthesized cue, or silence where there was no sound before. F2 → Audio has three new level sliders: "Gold, coins, finds and level-up", "Menu and button sounds", "Hurt, knocked out, siren, lizard hiss". All of it plays through the Effects bus, so the pause menu's Effects and Master volumes and the M mute apply; the start sting follows Music instead.

| Cue (where) | Before | Now | Recordings used | A/B category |
| --- | --- | --- | --- | --- |
| `sfx.coin(n)`: a fleck while digging, a washed pan, a sifted bucket, selling, winnings | Two square-wave beeps | One of three struck-metal clinks in turn (pitch varies ±60 cents) over a small coin rustle. `n` is the gold: bigger payouts are louder and add a second clink a fourth or fifth higher | `coin-1/2/3`, `coins-small` | `rewards` |
| `sfx.gold()`: nugget, rich batch, badge, big find | Five triangle-wave notes | A pouch of coins and four struck notes climbing a major chord | `coins-pouch`, `ting` | `rewards` |
| `sfx.find()`: item into the sack | Three triangle-wave notes | Leather rustle and two soft glass notes rising a fourth | `leather`, `glass` | `rewards` |
| `sfx.assay(g)`: assay grade from `payAssay` (new) | Silent | Pay dirt: three rising glass notes and a ringing top note, 0.7 s after the coin sound. Rich: five notes climbing further, over a bell. Barren, Trace and Promising stay silent | `glass`, `ting`, `bell` | `rewards` |
| `sfx.glint(n)`: gold glints from `payGlint` (new) | Silent | One or two tiny high glass ticks just after the shovel, one per extra spark | `glass` | `rewards` |
| `sfx.panSwirl()`, `sfx.panDunk()`: washing the pan (`89-goldfx.js`) | Band-pass noise ticks and a noise splash | Three water takes in turn while water runs over the lip; a deeper splash for the two dunks | `water-swirl-1/2/3`, `water-dunk` | `rewards` |
| `sfx.siftShake()`: the sifter's tray (`89-goldfx.js`) | A near-inaudible low noise tick | The approved sand-step recordings, pitched up, low-passed and kept quiet, as a gritty rub on each shake | `step-sand-1/2/3` (already shipped) | `rewards` |
| `sfx.buy()`: store and crew-store purchases | The coin beeps | Coins on the counter, the till's latch, one bright note | `coins-pouch`, `latch`, `ting` | `rewards` |
| `sfx.quota()`: the nightly quota leaving the wallet at dawn | Silent | Coins poured out (lower and slower) and a ledger shut | `coins-pouch`, `ui-close` | `rewards` |
| `sfx.levelUp()` | Same five notes as `gold` | A bell under five climbing notes; the top one is doubled so it rings on | `bell`, `ting` | `rewards` |
| Menu open / close (pause, store, inventory, field map, cards) | Silent | A page turn; a soft thump | `ui-open`, `ui-close` | `ui` |
| Button hover (mouse only) / press | Silent | A very quiet tick; a soft click | `ui-hover`, `ui-click` | `ui` |
| `sfx.deny()`: pressing a greyed-out button ("Need 45 more gold"), or the server refusing a purchase | Silent | Two dull wooden knocks, the second lower | `ui-deny` | `ui` |
| `sfx.hurt(n)`: any damage | An 80 Hz sine thud | One of two recorded body hits, louder for bigger damage | `hit-1/2` | `danger` |
| `sfx.ko()`: knocked out | Silent | The hit, then a body falling in the dirt | `hit-2`, `bodyfall` | `danger` |
| `sfx.lizard()`: a lizard starts chasing you | 0.6 s of band-pass noise | Still synthesized (no CC0 lizard recording was found): a dry hiss that swells and trails off, with a rattle on it. The twister and the dynamite fuse keep the plain `sfx.hiss` | none (Web Audio) | `danger` |
| `sfx.siren()`: curfew in one minute | Three identical sawtooth sweeps | Still synthesized: a hand-cranked siren. Two detuned saws wind up, sag, wind up again and run down over 7.5 s through a low-pass that opens with the pitch, with an echo | none (Web Audio) | `danger` |
| `sfx.startSting()`: the title screen's start press | Silent | The approved shovel hit, a low bell toll and two faint high notes. Skipped when a saved session resumes | `shovel` (already shipped), `bell`, `ting` | `ui` |

**Not done, on purpose.** There is no ambient pad on the title screen: browsers do not let a page play sound before the first click, so it could only start after the start press, and no CC0 material found was good enough to judge without hearing it. The generic `sfx.thud` (rocks, tumbleweeds, falls), `sfx.hiss`, `sfx.splash` (canteen), `sfx.beep`, wildlife, the Bride and the disco are unchanged and still synthesized.

### What was checked without listening

- Every new file decodes as mono 44.1 kHz MP3; sizes are 1.6 to 10.5 KB (106 KB for all 22). File levels are in the table below.
- `scripts/render-core-loop-reel.mjs` plays each cue in the running game, records the master bus, counts the sources each cue scheduled on the AudioContext, and measures the result. It then drives the real paths: opening the pause menu and the store, hovering and pressing store buttons with the mouse, pressing a greyed-out Buy button, a real purchase, `payAssay` at each grade, `addXP` to a new level, a new day with the quota paid, `hurt 10`, a knockout and the siren. Each one started the expected clips, with no console errors; the results are at the end of the [reel's notes](../asset-library/audio/review-reels/2026-11-10-core-loop.md).
- Mix levels were set against the approved digging clip, measured the same way: an ordinary coin sits about 3 dB under a dig, a nugget or level-up 2 to 3 dB over it, menu sounds 14 to 22 dB under it (the "no" knock 6 dB under), a heavy hit or a knockout 6 to 8 dB over it.

### New recordings, sources and licence

All are **CC0**. Each was trimmed, converted to mono 44.1 kHz MP3 and peak-normalised to -3 dBFS by `asset-library/audio/core-loop/build.sh`; the untouched originals are in `asset-library/audio/sources/core-loop/`.

| Shipped file in `public/audio/` | Original | Source / licence |
| --- | --- | --- |
| `coin-1.mp3`, `coin-2.mp3`, `coin-3.mp3` | `impactMetal_light_001`, `_002`, `_004.ogg` | [Impact Sounds by Kenney](https://kenney.nl/assets/impact-sounds), CC0 |
| `ting.mp3` | `impactMetal_light_003.ogg` | Impact Sounds by Kenney, CC0 |
| `glass.mp3` | `impactGlass_light_000.ogg` | Impact Sounds by Kenney, CC0 |
| `bell.mp3` | `impactBell_heavy_000.ogg` | Impact Sounds by Kenney, CC0 |
| `ui-deny.mp3` | `impactWood_light_000.ogg` | Impact Sounds by Kenney, CC0 |
| `hit-1.mp3`, `hit-2.mp3` | `impactPunch_medium_000`, `_003.ogg` | Impact Sounds by Kenney, CC0 |
| `bodyfall.mp3` | `impactSoft_heavy_003.ogg` | Impact Sounds by Kenney, CC0 |
| `coins-pouch.mp3`, `coins-small.mp3` | `handleCoins.ogg`, `handleCoins2.ogg` | [RPG Audio by Kenney](https://kenney.nl/assets/rpg-audio), CC0 |
| `leather.mp3`, `latch.mp3` | `handleSmallLeather.ogg`, `metalLatch.ogg` | RPG Audio by Kenney, CC0 |
| `ui-open.mp3`, `ui-close.mp3` | `bookFlip2.ogg`, `bookClose.ogg` | RPG Audio by Kenney, CC0 |
| `ui-hover.mp3`, `ui-click.mp3` | `rollover2.ogg`, `click3.ogg` | [UI Audio by Kenney](https://kenney.nl/assets/ui-audio), CC0 |
| `water-swirl-1.mp3`, `-2`, `-3`, `water-dunk.mp3` | `splash_06`, `splash_13`, `splash_15`, `splash_04.ogg` | [40 CC0 water / splash / slime SFX by rubberduck](https://opengameart.org/content/40-cc0-water-splash-slime-sfx) on OpenGameArt, CC0 |

### File levels

Measured with `ffprobe`, `ffmpeg -af volumedetect` and `ffmpeg -af loudnorm=print_format=summary`. Most clips are too short for an integrated loudness reading, so the in-game levels in the reel's notes are the ones to compare.

| File | Bytes | Length s | Peak dBFS | Mean dBFS | Integrated LUFS | True peak dBTP |
| --- | --- | --- | --- | --- | --- | --- |
| `coin-1.mp3` | 2206 | 0.29 | -3.0 | -22.1 | too short | -2.9 |
| `coin-2.mp3` | 2075 | 0.26 | -2.4 | -22.2 | too short | -2.3 |
| `coin-3.mp3` | 2128 | 0.26 | -3.1 | -22.3 | too short | -3.0 |
| `coins-small.mp3` | 6277 | 0.34 | -2.8 | -24.8 | too short | -2.8 |
| `coins-pouch.mp3` | 10549 | 0.84 | -3.0 | -31.4 | -26.9 | -2.4 |
| `ting.mp3` | 3298 | 0.52 | -2.5 | -22.2 | -18.9 | -2.5 |
| `glass.mp3` | 2049 | 0.26 | -3.3 | -23.2 | too short | -3.2 |
| `bell.mp3` | 7067 | 1.52 | -3.0 | -28.1 | -29.5 | -3.0 |
| `leather.mp3` | 3510 | 0.31 | -3.1 | -25.6 | too short | -3.1 |
| `latch.mp3` | 3720 | 0.29 | -3.0 | -24.9 | too short | -2.6 |
| `water-swirl-1.mp3` | 8050 | 0.50 | -3.0 | -25.8 | -22.1 | -2.9 |
| `water-swirl-2.mp3` | 9847 | 0.81 | -3.0 | -28.3 | -24.4 | -2.4 |
| `water-swirl-3.mp3` | 7973 | 0.50 | -3.0 | -29.5 | -25.8 | -3.0 |
| `water-dunk.mp3` | 10287 | 1.04 | -3.0 | -25.5 | -23.5 | -2.9 |
| `ui-open.mp3` | 7371 | 0.47 | -3.0 | -30.5 | -27.4 | -2.9 |
| `ui-close.mp3` | 3121 | 0.24 | -3.2 | -21.9 | too short | -3.1 |
| `ui-hover.mp3` | 1582 | 0.08 | -3.0 | -25.3 | too short | -3.0 |
| `ui-click.mp3` | 1921 | 0.13 | -3.1 | -29.4 | too short | -3.0 |
| `ui-deny.mp3` | 2179 | 0.31 | -3.1 | -24.2 | too short | -3.0 |
| `hit-1.mp3` | 3662 | 0.47 | -3.0 | -19.1 | -21.6 | -3.0 |
| `hit-2.mp3` | 4132 | 0.50 | -3.0 | -20.3 | -21.9 | -3.0 |
| `bodyfall.mp3` | 3193 | 0.57 | -3.0 | -18.5 | -23.7 | -3.0 |

## A/B against the previous game audio

| Category | `old` | `new` | Current default |
| --- | --- | --- | --- |
| Wind | Soft, slowly pulsing, low-pass noise | Short CC0 whoosh loop with a quieter noise bed | **Old**; the recorded loop adds texture but repeats more often |
| Day/night ambience | Silence | Birds by day, crickets by night | New |
| Rain at the ending | Filtered noise | Longer CC0 rain loop with noise beneath it | New |
| Footsteps | Silence | Six alternating sand/stone recordings | New |
| Digging | Noise scrape plus low tone | CC0 shovel hit layered with a CC0 sand step, four variants in rotation | New |
| Metal hits | Triangle sweep plus noise | CC0 metal click | New |
| Tent, house, bunk | Silence | Cloth and wooden-door recordings | New |

The [original wind capture](audio-ab/wind-old.webm) and [level-matched recorded wind capture](audio-ab/wind-new.webm) are eight seconds each, taken at the same open-lakebed location with the other new ambience off. Their average levels are within 1 dB. Compare them in-game as well, because the first capture cannot show how the wind behaves during a storm or inside a tent.

## Current soundscape

| When you hear it | What makes the sound |
| --- | --- |
| Open lakebed by day | Original pulsing synthesized wind by default, plus a CC0 bird recording. The optional recorded-wind mode replaces most of the synthesized wind with a CC0 wind loop. |
| Open lakebed by night | Original wind and a CC0 cricket recording. Recorded-wind mode and tent muffling can be compared separately. |
| Rain at Lil's strongbox ending | CC0 rain loop, with a quiet filtered-noise fallback. |
| Walking and running | Three CC0 sand-step recordings, rotated and slightly pitch-varied; three stone-step recordings for tent/office floors. A short filtered-noise step is the loading fallback. Running has a faster cadence. These are local-player footsteps only. |
| Digging | Four pre-mixed clips, each the CC0 shovel hit layered with a different CC0 sand step (Fantozzi L1, R1, L3, R3), played in turn and varied slightly in pitch so back-to-back digs never repeat. The bare shovel, then the old filtered-noise scrape and low tone, cover loading. |
| Entering/leaving tents or the Superintendent's house | CC0 cloth rustle for tents. The Superintendent's house plays a CC0 wooden-door-opening recording both ways; leaving plays it slightly lower. |
| Lying down/getting up | CC0 cloth rustle. |
| Now and then, out on the lake | Every 3–5 minutes (randomised) one far-off call from a random side, never the same one twice in a row: a red-tailed hawk by day, a mourning dove in the morning (before 10:00), coyotes (distant or near) or an owl at night. Skipped in tents and dust storms. `audio call` in the console plays one now; F2 → Audio → Desert calls sets the level. |
| Metal hit, loot collision, shovel bonk | CC0 metal click; the old high triangle tone plus noise are the loading fallback. |
| Finding ordinary loot, important loot, receiving seeds, detector beeps | Web Audio oscillators: ascending three-note find, longer five-note gold fanfare, two-note coin chirp, or a signal-dependent square-wave beep. |
| Lizard pursuit/bite, shouts, canteen fill, impact/damage | Web Audio filtered noise and short sine/sawtooth oscillator sweeps (`hiss`, `bite`, `shout`, `splash`, `thud`). |
| Twisters, tumbleweeds, haboobs | Separate looping filtered-noise wind layers whose levels follow the hazard. A twister also triggers `hiss` when it grabs a player. |
| Landslides, sinkholes | Low filtered-noise rumble loops; landslides add a rising tone and hiss warning. Nearby bouncing rocks and falls trigger `thud`. |
| Vultures, javelinas, mountain lion | Vulture screech = band-pass noise plus a descending sawtooth; javelina squeals/snorts = sawtooth sweeps; lion growl/roar = low oscillator and noise; lion stalking also adds a synthesized heartbeat. |
| Curfew and the Drowned Bride | The curfew warning is three synthesized siren sweeps. Police spotting adds two warning beeps and a browser text-to-speech line. the Bride has a low drone, whisper-like filtered noise, sting, heartbeat, jumpscare, and browser text-to-speech. Old police car siren/engine loop nodes are silent because officers now walk. |
| Cards, chat, flashlight, onion | Brief synthesized clicks, noise ticks, or oscillator sweeps. Blackjack win/loss reuses coin/thud. |
| Disco party | A four-bar sequenced Web Audio composition: synthesized kick, hat, snare, bass, and chords. It is the game's only continuous music. |
| Other campers talking | Live WebRTC microphone audio, heard through a positional HRTF panner. Browser text-to-speech is used for the police/the Bride lines above, not for regular text dialogue. |

Unused variants, retired clips, source recordings, and review reels are kept in the [asset library](../asset-library/CATALOG.md).

## Recording sources and license

All shipped recordings below are **CC0**. They were converted to mono 22.05 kHz MP3 to keep the download small. The older `feature/immersive-audio` branch contains 21 unwired MP3s with no source/license record; those files were reviewed but were **not** included here.

| Shipped files in `public/audio/` | Original recording | Source/license |
| --- | --- | --- |
| `shovel.mp3` | `shovel.ogg`, trimmed to 0.52 s with a short fade | [Shovel Sound by themightyglider, derived from RavenWolfProds](https://opengameart.org/content/shovel-sound), CC0 |
| `dig-shovel-sand-l1/r1/l3/r3.mp3` | `shovel.ogg` mixed with Fantozzi `SandL1`, `SandR1`, `SandL3`, `SandR3`, level-matched to `shovel.mp3` | Shovel Sound and Fantozzi's Footsteps (both linked in this table), CC0 |
| `call-hawk.mp3` | Loudest R30-34 Red Tailed Hawk passage, noise-reduced (spectral gating) and high-passed | [R30-34 Red Tailed Hawk by craigsmith](https://freesound.org/people/craigsmith/sounds/479610/) on Freesound, CC0 |
| `call-coyotes-distant.mp3` | Loudest Coyotes, distant howls and barks passage, noise-reduced (spectral gating) and high-passed | [Coyotes, distant howls and barks by TRP](https://freesound.org/people/TRP/sounds/616994/) on Freesound, CC0 |
| `call-coyotes-near.mp3` | Loudest coyote barks and howls passage, noise-reduced (spectral gating) and high-passed | [coyote barks and howls by dkaufman](https://freesound.org/people/dkaufman/sounds/256533/) on Freesound, CC0 |
| `call-owl.mp3` | Loudest Owl Hoot passage, noise-reduced (spectral gating) and high-passed | [Owl Hoot by Breviceps](https://freesound.org/people/Breviceps/sounds/465697/) on Freesound, CC0 |
| `call-dove.mp3` | Loudest mourning_dove passage, noise-reduced (spectral gating) and high-passed | [mourning_dove by nathankwright](https://freesound.org/people/nathankwright/sounds/456930/) on Freesound, CC0 |
| `step-sand-1..3.mp3`, `step-stone-1..3.mp3` | Fantozzi `SandL1..3` and `StoneL1..3` | [Fantozzi's Footsteps](https://opengameart.org/content/fantozzis-footsteps-grasssand-stone), CC0 |
| `birds.mp3` | `birds-isaiah658.ogg` | [Ambient Bird Sounds by isaiah658](https://opengameart.org/content/ambient-bird-sounds), CC0 |
| `crickets.mp3` | `crickets-oneloop.mp3` | [Crickets Ambient Noise by Wolfgang_/Ted Kerr](https://opengameart.org/content/crickets-ambient-noise-loopable), CC0 |
| `wind.mp3` | `wind woosh loop_0.ogg` | [wind whoosh loop by SketchMan3](https://opengameart.org/content/wind-whoosh-loop), CC0 |
| `rain.mp3` | `1.ogg` from `Rain OGG.zip` | [Rain (loopable) by Ylmir](https://opengameart.org/content/rain-loopable), CC0 |
| `cloth1.mp3`, `cloth2.mp3`, `doorOpen_1.mp3`, `metalClick.mp3` | Same-named OGGs | [RPG Audio by Kenney](https://kenney.nl/assets/rpg-audio), CC0 |

The original CC0 licenses are linked on each source page. Kenney also includes a `License.txt` in the RPG Audio download. This table credits the makers even though CC0 does not require attribution.
