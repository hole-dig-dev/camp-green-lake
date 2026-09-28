# Audio reel map and narration handoff

The [original MP3](audio-showcase.mp3) runs about 2:01. The time below is where each sound starts, rounded to a tenth of a second; use the [full cue sheet](audio-showcase.md) as the source of order. The original has only about 0.3 seconds between sounds, so a narrated version needs a new timeline with the voice spoken **before** each example.

## A/B comparison: 00:00–00:23

| Start | What to announce | What plays | Current game default |
| --- | --- | --- | --- |
| 00:00.0 | “Wind A: original.” | Soft, slowly pulsing, filtered noise made in the browser. | **A** |
| 00:04.3 | “Wind B: recorded.” | A short CC0 wind whoosh loop, mixed to roughly the same average level. | A |
| 00:08.6 | “Rain A: original.” | Synthesized, filtered noise used at the suitcase ending. | B |
| 00:12.4 | “Rain B: recorded.” | CC0 rain loop. | **B** |
| 00:16.2 | “Dig A: original.” | Synthesized dirt scrape and a low tone. | B |
| 00:17.9 | “Dig B: recorded.” | CC0 shovel hitting dirt. | **B** |
| 00:19.6 | “Metal A: original.” | Synthesized triangle tone plus noise. | B |
| 00:21.3 | “Metal B: recorded.” | CC0 metal click. | **B** |

The user already said the original wind sounds good. Keep that preference in mind when discussing the wind pair. The other pairs have not been rated by the user. A and B should be presented as choices, with any quality judgment clearly marked as an opinion.

## Background and movement: 00:23–00:45

| Start | What to announce | What plays |
| --- | --- | --- |
| 00:23.0 | “Daytime birds.” | Outdoor bird ambience; previously silent. |
| 00:27.3 | “Nighttime crickets.” | Outdoor cricket ambience; previously silent. |
| 00:31.6 | “Sand footstep one.” | First of three recorded sand steps. |
| 00:32.8 | “Sand footstep two.” | Second sand step. |
| 00:33.9 | “Sand footstep three.” | Third sand step. |
| 00:35.0 | “Stone footstep one.” | First of three recorded hard-floor steps. |
| 00:36.2 | “Stone footstep two.” | Second hard-floor step. |
| 00:37.3 | “Stone footstep three.” | Third hard-floor step. |
| 00:38.5 | “Tent cloth.” | Fabric rustle when entering or leaving a tent. |
| 00:40.1 | “Bunk cloth.” | Fabric rustle when lying down or getting up. |
| 00:41.7 | “House door opening.” | Wooden door opening at the Warden's house. |
| 00:43.3 | “House door closing.” | Wooden door closing. |

The old game had no bird, cricket, footstep, tent, house-door, or bunk sounds. There is no audible A side for these.

## Hazards and wildlife: 00:45–01:19

| Start | What to announce | What plays |
| --- | --- | --- |
| 00:44.9 | “Twister wind.” | Low filtered wind loop. |
| 00:47.8 | “Tumbleweed gust.” | Higher, band-pass wind loop. |
| 00:50.7 | “Haboob wind.” | Gusting dust-storm loop. |
| 00:53.6 | “Landslide warning.” | Falling tone and hiss before rocks arrive. |
| 00:55.7 | “Landslide rumble.” | Low rockslide loop. |
| 00:58.6 | “Sinkhole rumble.” | Lower ground-rumble loop. |
| 01:01.5 | “Vulture screech.” | Noise and descending sawtooth tone. |
| 01:03.0 | “Javelina squeal.” | High sawtooth sweep and noise. |
| 01:04.5 | “Javelina snort.” | Low sawtooth sweep. |
| 01:06.0 | “Lion growl.” | Pulsing low oscillator heard while it hunts nearby. |
| 01:08.5 | “Lion target warning.” | Low falling tone. |
| 01:09.9 | “Lion pounce.” | Short rising tone. |
| 01:11.3 | “Lion roar.” | Noise and falling low tones. |
| 01:12.9 | “Lion swat.” | Very short square-wave hit. |
| 01:14.3 | “Lion heartbeat.” | Two low pulses. |
| 01:15.8 | “Lizard hiss.” | High filtered noise. |
| 01:17.3 | “Lizard bite.” | Noise and falling sawtooth tone. |

## Curfew and Madame Zeroni: 01:19–01:36

| Start | What to announce | What plays |
| --- | --- | --- |
| 01:18.8 | “Curfew siren.” | Three synthesized siren sweeps. |
| 01:24.3 | “Patrol arrival.” | Low descending warning tone. |
| 01:26.2 | “Police spotted you.” | Two warning beeps. |
| 01:28.0 | “Madame Zeroni approaching.” | Drone and whisper-like filtered noise. |
| 01:31.6 | “Zeroni sting.” | Low sweep, hiss, and high sustained tone. |
| 01:34.7 | “Zeroni jumpscare.” | Brief harsh tone and noise hit. |

The game also speaks some police and Zeroni lines using the listener's browser text-to-speech engine. Those variable voices are not in this fixed audio reel.

## Game cues and music: 01:36–end

| Start | What to announce | What plays |
| --- | --- | --- |
| 01:36.4 | “Ordinary find.” | Three rising notes. |
| 01:37.9 | “Important find or level up.” | Five rising notes. |
| 01:39.8 | “Seeds or coin.” | Two-note chirp. |
| 01:41.2 | “Detector beep.” | Short signal-dependent beep. |
| 01:42.6 | “Camper shout.” | Brief rising buzzy tone. |
| 01:44.0 | “Canteen fill.” | Splash-like filtered noise. |
| 01:45.4 | “Impact or damage.” | Low thud. |
| 01:46.8 | “Card click.” | Brief tone and noise tick. |
| 01:48.2 | “Flashlight on.” | High square-wave click. |
| 01:49.6 | “Flashlight off.” | Lower square-wave click. |
| 01:51.0 | “Onion use.” | Falling triangle tone. |
| 01:52.4 | “Chat notification.” | Very short triangle tone. |
| 01:53.8 | “Disco party music.” | Sequenced synthesized kick, hat, snare, bass, and chords. |

Live proximity voice chat depends on the players' microphones, so it cannot have a fixed example in the reel. The old police-car siren and engine loops are inactive because the officers now walk.

## Prompt to hand to Claude

```text
Please make a narrated version of the Camp Green Lake game audio reel for me. I need to know exactly what I am hearing without reading a timestamp sheet while it plays.

The source files are:
- /home/botuser/camp-green-lake/docs/audio-showcase.mp3 (the 2:01 original)
- /home/botuser/camp-green-lake/docs/audio-narration-handoff.md (plain-language map and exact cue order)
- /home/botuser/camp-green-lake/docs/audio-showcase.md (56-cue timing sheet)
- /home/botuser/camp-green-lake/scripts/render-audio-showcase.mjs (how the original was assembled)

Use your available text-to-speech and audio editing tools to produce a NEW MP3, leaving the original untouched. Rebuild the timeline so a clear spoken label comes before every sound. Leave enough silence after each label to hear the whole example. The original has only about 0.3 seconds between cues, which is too short for narration; do not merely overlay speech on its existing timeline. Keep effects at useful listening levels without clipping, and preserve their character and the level relationship within each A/B pair. Use the map to split or re-render the examples as needed.

For the first four pairs, announce both versions plainly: "Wind A, original synthesized wind"; play it; "Wind B, recorded wind"; play it. Do the same for rain, digging, and metal. After each pair, you may give a one-sentence opinion about clarity, repetition, or fit for the dusty camp, but call it your opinion and let me decide. I already like the original wind, and it is the game's current default. Do not silently switch that preference. For birds, crickets, footsteps, and building sounds, explain that the old game was silent and these are new additions.

Then label every remaining cue in the map before playing it. Group related sounds with a short spoken section title if that helps. Do not claim the fixed reel contains live player voice chat or the browser's variable police/Zeroni speech.

Deliver (1) a downloadable narrated MP3, (2) its NEW timestamp map matching the final audio, and (3) a short written recommendation for each A/B pair with any uncertainty stated. Verify the final MP3 decodes and that every spoken label and sound is audible. If you can access my Telegram bot, send the finished MP3 there too. Tell me exactly where the files are saved.
```
