# Camp Green Lake sound inventory

The game starts Web Audio on the player's first game-start click. Master volume controls everything; Effects controls recordings, ambience, and synthesized effects; Music controls the synthesized disco track; Voice controls live proximity chat. **M** mutes the master bus. Recordings load asynchronously, so the first use of a clip can play its synthesized fallback.

The **original synthesized wind remains the default**, because it already suits the lakebed. Other newly added recordings default on. To A/B at the same spot, open the developer console with backtick and use `audio wind old`, `audio wind new`, or `audio status`. `audio old` and `audio new` compare the whole soundscape. Categories are `wind`, `ambience` (birds/crickets), `rain`, `steps`, `dig`, `metal`, and `props` (tent/house/bunk). These choices affect only your browser and reset on reload. The old game had no footsteps, birds, crickets, or tent/bunk Foley, so their "old" mode is silent.

## A/B against the previous game audio

| Category | `old` | `new` | Current default |
| --- | --- | --- | --- |
| Wind | Soft, slowly pulsing, low-pass noise | Short CC0 whoosh loop with a quieter noise bed | **Old**; the recorded loop adds texture but repeats more often |
| Day/night ambience | Silence | Birds by day, crickets by night | New |
| Rain at the ending | Filtered noise | Longer CC0 rain loop with noise beneath it | New |
| Footsteps | Silence | Six alternating sand/stone recordings | New |
| Digging | Noise scrape plus low tone | CC0 shovel-in-dirt hit | New |
| Metal hits | Triangle sweep plus noise | CC0 metal click | New |
| Tent, house, bunk | Silence | Cloth and wooden-door recordings | New |

The [original wind capture](audio-ab/wind-old.webm) and [level-matched recorded wind capture](audio-ab/wind-new.webm) are eight seconds each, taken at the same open-lakebed location with the other new ambience off. Their average levels are within 1 dB. Compare them in-game as well, because the first capture cannot show how the wind behaves during a storm or inside a tent.

## Current soundscape

| When you hear it | What makes the sound |
| --- | --- |
| Open lakebed by day | Original pulsing synthesized wind by default, plus a CC0 bird recording. The optional recorded-wind mode replaces most of the synthesized wind with a CC0 wind loop. |
| Open lakebed by night | Original wind and a CC0 cricket recording. Recorded-wind mode and tent muffling can be compared separately. |
| Rain at the suitcase ending | CC0 rain loop, with a quiet filtered-noise fallback. |
| Walking and running | Three CC0 sand-step recordings, rotated and slightly pitch-varied; three stone-step recordings for tent/office floors. A short filtered-noise step is the loading fallback. Running has a faster cadence. These are local-player footsteps only. |
| Digging | A short CC0 shovel-in-dirt recording, varied slightly in pitch; the old filtered-noise scrape and low tone are the loading fallback. |
| Entering/leaving tents or the Warden's house | CC0 cloth rustle for tents and CC0 wooden-door recordings for the house. |
| Lying down/getting up | CC0 cloth rustle. |
| Metal hit, loot collision, shovel bonk | CC0 metal click; the old high triangle tone plus noise are the loading fallback. |
| Finding ordinary loot, important loot, receiving seeds, detector beeps | Web Audio oscillators: ascending three-note find, longer five-note gold fanfare, two-note coin chirp, or a signal-dependent square-wave beep. |
| Lizard pursuit/bite, shouts, canteen fill, impact/damage | Web Audio filtered noise and short sine/sawtooth oscillator sweeps (`hiss`, `bite`, `shout`, `splash`, `thud`). |
| Twisters, tumbleweeds, haboobs | Separate looping filtered-noise wind layers whose levels follow the hazard. A twister also triggers `hiss` when it grabs a player. |
| Landslides, sinkholes | Low filtered-noise rumble loops; landslides add a rising tone and hiss warning. Nearby bouncing rocks and falls trigger `thud`. |
| Vultures, javelinas, mountain lion | Vulture screech = band-pass noise plus a descending sawtooth; javelina squeals/snorts = sawtooth sweeps; lion growl/roar = low oscillator and noise; lion stalking also adds a synthesized heartbeat. |
| Curfew and Madame Zeroni | The curfew warning is three synthesized siren sweeps. Police spotting adds two warning beeps and a browser text-to-speech line. Zeroni has a low drone, whisper-like filtered noise, sting, heartbeat, jumpscare, and browser text-to-speech. Old police car siren/engine loop nodes are silent because officers now walk. |
| Cards, chat, flashlight, onion | Brief synthesized clicks, noise ticks, or oscillator sweeps. Blackjack win/loss reuses coin/thud. |
| Disco party | A four-bar sequenced Web Audio composition: synthesized kick, hat, snare, bass, and chords. It is the game's only continuous music. |
| Other campers talking | Live WebRTC microphone audio, heard through a positional HRTF panner. Browser text-to-speech is used for the police/Zeroni lines above, not for regular text dialogue. |

## Recording sources and license

All shipped recordings below are **CC0**. They were converted to mono 22.05 kHz MP3 to keep the download small. The older `feature/immersive-audio` branch contains 21 unwired MP3s with no source/license record; those files were reviewed but were **not** included here.

| Shipped files in `public/audio/` | Original recording | Source/license |
| --- | --- | --- |
| `shovel.mp3` | `shovel.ogg`, trimmed to 0.52 s with a short fade | [Shovel Sound by themightyglider, derived from RavenWolfProds](https://opengameart.org/content/shovel-sound), CC0 |
| `step-sand-1..3.mp3`, `step-stone-1..3.mp3` | Fantozzi `SandL1..3` and `StoneL1..3` | [Fantozzi's Footsteps](https://opengameart.org/content/fantozzis-footsteps-grasssand-stone), CC0 |
| `birds.mp3` | `birds-isaiah658.ogg` | [Ambient Bird Sounds by isaiah658](https://opengameart.org/content/ambient-bird-sounds), CC0 |
| `crickets.mp3` | `crickets-oneloop.mp3` | [Crickets Ambient Noise by Wolfgang_/Ted Kerr](https://opengameart.org/content/crickets-ambient-noise-loopable), CC0 |
| `wind.mp3` | `wind woosh loop_0.ogg` | [wind whoosh loop by SketchMan3](https://opengameart.org/content/wind-whoosh-loop), CC0 |
| `rain.mp3` | `1.ogg` from `Rain OGG.zip` | [Rain (loopable) by Ylmir](https://opengameart.org/content/rain-loopable), CC0 |
| `cloth1.mp3`, `cloth2.mp3`, `doorOpen_1.mp3`, `doorClose_1.mp3`, `metalClick.mp3` | Same-named OGGs | [RPG Audio by Kenney](https://kenney.nl/assets/rpg-audio), CC0 |

The original CC0 licenses are linked on each source page. Kenney also includes a `License.txt` in the RPG Audio download. This table credits the makers even though CC0 does not require attribution.
