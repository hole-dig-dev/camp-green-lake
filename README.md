# Camp Green Lake

A multiplayer browser digging game set in the dry lake bed from *Holes*. Dig five-foot holes, sell what you find to Mr. Sir, dodge yellow-spotted lizards, and work with your friends to find what Kissin' Kate Barlow buried.

Inspired by the co-op digging game *Needle In A Haystack*: a huge search area, one buried prize, and a group of friends arguing about where to dig.

## Play

- **WASD** walk, **Shift** run, **Space** jump
- **Click** to lock the mouse, then **hold click** (or **E**) to dig
- **F** talk, buy, sell, or sit down at the card table
- **Q** eat an onion (lizards won't come near you for 45 seconds)
- **1–5** shout at your friends, **T** toggle the metal detector, **M** sound
- **Voice chat** (proximity, like Lethal Company / Rust): click **Voice off** in the bottom-right HUD to turn on your mic (your browser will ask permission). Hold **B** to talk (push-to-talk is the default), or click the mode button to switch to always-on mic. Click **Mute voices** to silence everyone else without muting game sound. Whoever's talking gets a green glow on their name tag. **M** (sound off) mutes voice chat too, since it shares the game's volume.
- **Esc** pauses (a touch-screen game gets a small pause button in the HUD instead): Resume, Options, Controls, Restart (respawns you at camp; keeps your seeds, gear, and the team's progress), or Quit to title. The game keeps running for everyone else while you're paused.

In Options you can adjust mouse sensitivity, invert Y, touch look speed, field of view, master/effects/music/voice-chat volume, shadows, render quality, and the FPS counter, and rebind every control except Esc and the console key (voice push-to-talk is rebindable too). Settings and key bindings are saved in the browser (`localStorage`) and reload with you. WASD and the arrow keys always move you, even if you rebind them.

Find the gold tube marked **KB** and take it to the Warden. She'll mark the search area with red flags. The suitcase is buried deeper than five feet, so you'll need the long-handled shovel from the Wreck Room.

Also in camp:
- **D Tent blackjack**: X-Ray deals. Bet your sunflower seeds, blackjack pays 3 to 2.
- **Conversations**: walk up to Mr. Sir, the Warden, or the D Tent crew and press F. Some of them know where things are buried.

<details>
<summary>Easter egg (spoiler)</summary>

Type <code>disco</code> while playing.

</details>

## Run it

```sh
npm install
HOST_TOKEN=some-long-random-string npm start
```

The server listens on `127.0.0.1:4300` (set `PORT` to change it). Put it behind a reverse proxy with HTTPS for friends to join — voice chat needs a secure context, same as the mic permission prompt does. WebSockets are served at `/ws`. Set `ICE_SERVERS` to a JSON array of `RTCIceServer` objects (e.g. `[{"urls":"turn:host:3478","username":"u","credential":"p"}]`) to give proximity voice a TURN server; without it, voice falls back to STUN only, which some players behind strict NATs won't be able to connect through. Caddy example:

```
holes.example.com {
	encode gzip
	reverse_proxy localhost:4300
}
```

The world (dug holes, found items, the KB tube, the suitcase) is saved to `data/world.json`. After someone digs up the suitcase, the camp resets to a new day ten minutes later.

### Updating without kicking players

Players keep their progress in their browser tab, so you can restart the server at any time; open pages reconnect on their own. To load new client code into pages that are already open:

```sh
curl -H "x-admin: $HOST_TOKEN" localhost:4300/admin/update
```

Other admin endpoints (same header): `/admin/who` lists who's connected. Admin endpoints only answer requests that arrive with no `X-Forwarded-For` header (i.e. local `curl`, not through a reverse proxy or Funnel) — they're unreachable from the network at all, correct token or not.

## Running it publicly

The server only listens on `127.0.0.1`, so put it behind [Tailscale Funnel](https://tailscale.com/kb/1223/funnel) (or any other HTTPS reverse proxy) to let people outside your tailnet in:

```sh
tailscale funnel --bg --https=10000 http://127.0.0.1:4300
```

A few env vars matter once anyone outside your household can reach the game:

| Env var | What it does |
|---|---|
| `CAMP_PASSWORD` | If set, the title screen asks for this password before showing any game state (the world isn't sent to a socket until it's authenticated). Share it as part of an invite link: `https://your-funnel-host/?camp=your-password` fills the field in and remembers it (like the existing `?host=` link for the host token). |
| `PUBLIC=1` | Marks the server as internet-facing. Refuses to start unless `CAMP_PASSWORD` is also set, or you explicitly pass `ALLOW_OPEN=1` to run without one on purpose. Also refuses to start if `DEV_MODE=1` is set alongside it. |
| `ALLOW_OPEN=1` | Opts out of the `PUBLIC=1` + `CAMP_PASSWORD` requirement — an open camp anyone with the link can join. |
| `DEV_MODE=1` | **Never use this on a server other people connect to.** It gives every camper host powers (the console, the clock, spawning hazards). The server prints a loud warning at startup if it's on, and refuses to start at all if `PUBLIC=1` is also set. |

Example for a small private game with friends:

```sh
PORT=4300 CAMP_PASSWORD='a few random words' PUBLIC=1 HOST_TOKEN=some-long-random-string npm start
tailscale funnel --bg --https=10000 http://127.0.0.1:4300
```

Behind Funnel, every request arrives from `127.0.0.1`; Funnel adds an `X-Forwarded-For` header carrying the real caller's address, which the server uses for its per-IP connection and request limits (max simultaneous connections per address, new connections per minute, HTTP requests per minute). Without that header (e.g. hitting the server directly over the tailnet, or via `curl` on the box itself) it falls back to the raw socket address.

### What's still client-authoritative

Item locations, the seed count in your sack, and who found what are worked out in the browser from a shared deterministic random seed — the server never learns where the suitcase is. That means a modified client could, in principle, claim to have found the KB tube or the suitcase, or report a bigger sack value than it should. The server clamps and rate-limits what it can (dig distance/rate, sell amount/rate, chat/ping/hazard spam, connection limits) but can't fully verify loot without duplicating the client's world generation server-side — out of scope here. See the code comments in `server.js` near each `case` for what is and isn't checked.

## Developer console

Press **`** (the key left of 1) in game to open the console, or tap the **>_** button on a touch screen. Type `help` for the full list. Commands are case-insensitive:

| Command | What it does |
|---|---|
| `twister [distance]` | Spawn a twister ~45 m in front of you, heading your way. Everyone in camp sees it. |
| `landslide [distance]` | Trigger a rockslide off Big Thumb ~50 m out from you: 8-20 boulders fall, bounce and roll. Everyone in camp sees it. |
| `tumbleweed [distance]` | Blow in 1-3 giant tumbleweeds ~55 m out, heading your way: comically huge, bouncy, and fast. Get in one's way and you're stuck to it, riding around until you mash Space free or get flung off. Everyone in camp sees them. |
| `time <hh:mm>` | Set the camp clock for everyone, e.g. `time 13:00`. |
| `heal` / `hurt [n]` | Refill health and water / take damage. |
| `tp <x> <z>` / `tp camp` | Teleport. |
| `where` | Print your position. |

Only the host can use it on a normal server. Run the server with `DEV_MODE=1` (the play-test server does) to give everyone host powers, including the console and the hidden `sploosh` admin panel. Solo offline play can always use it.

**Adding a command:** one line near the other `command(...)` calls in `public/index.html`:
`command('name', {usage: 'name <arg>', help: 'what it does', run(args) { ...; return 'reply'; }})`

**Adding a spawnable hazard:** add an entry to the `ENV` registry (`ENV.sandstorm = {spawn: o => ...}`, where `o` is `{x, z, a}`) and a command that calls `spawnAhead('sandstorm', dist)`. The server relays hazards spawned by the host, so every client builds the same one.

## Play-test logging

Every server session writes what happened to `data/logs/<YYYY-MM-DD>.jsonl` (JSON Lines — one JSON object per
event per line), so a person or an LLM with shell access can answer things like "did a lizard bite anyone around
3pm?" straight from the log file. Logging is on by default (buffered and async — it never blocks the game loop
or crashes it); set `PLAYLOG=0` to turn it off. Files roll over past ~50MB and files older than 14 days are
deleted on startup. Secrets (`HOST_TOKEN`, the `host` field in join messages) are never logged.

Every line has `ts` (wall-clock ISO time), `gt` (in-game clock "hh:mm", matching the HUD), and `t` (event type),
plus type-specific fields. Player events carry `id` (connection id) and `n` (display name). See the comment
block at the top of `logger.js` for the full list of event types and fields — joins/leaves, position snapshots,
chat/shouts, damage/knockouts/revives, lizard chases and bites, twister warnings and throws, item finds, heavy
loot, console commands, the team quota/curfew/fired cycle, police/Zeroni mode changes, client JS errors, fps
samples, and a compact "what this client sees nearby" report (lizards, D Tent bots, remote players, twisters —
those live client-side, so each client reports its own view).

### Querying the logs: `scripts/logq.js`

```sh
node scripts/logq.js --player JT --type hurt,ko --since 15:00        # what hurt JT, from 3pm on
node scripts/logq.js --near 120,-40 --radius 20 --since "10 min ago" # what happened near that spot recently
node scripts/logq.js --type err --tail 20                            # the last 20 client errors
node scripts/logq.js --summary                                       # per-player damage/KOs/finds/errors + error list
```

`--since`/`--until` take `hh:mm` (the in-game clock) or a wall-clock time / `"N min/hours ago"`. Add `--json` for
raw JSON instead of one-liners, or `--file <path>` to read one specific log file. Run with no arguments for the
full option list.

## How it's built

- `public/index.html`: the whole game in one file. Three.js (r128) for rendering, WebAudio for sound effects and music, no build step.
- `server.js`: a small Node server using `ws`. It relays player positions, digs, and shouts, and keeps the shared world state.
- `logger.js` + `scripts/logq.js`: play-test event logging and its query tool (see "Play-test logging" above).
- The lake bed is a 301×301 heightmap. Each hole is stored as a center and a depth, and the terrain around it is rebuilt when someone digs, so holes (and the dirt piles next to them) sync between players as a few bytes each.
- Buried items come from a seeded random generator, so every player has the same camp without the server sending the item list.

### Proximity voice chat

Real WebRTC audio, peer-to-peer between players' browsers (a mesh: everyone connects directly to everyone
nearby, no media server) — fine for the handful of campers a session actually has at once.

- **Signaling** rides the existing game WebSocket: the client sends `{t:'rtc', to, d}` and the server relays
  it to that one target only (`server.js`, the `'rtc'` case), tagging it with the sender's id. It never
  broadcasts. SDP offers/answers run a few KB, well past what every other message needs, so `'rtc'` gets its
  own size ceiling and a bigger token-bucket charge instead of loosening the limit for everything else.
- **Connectivity**: STUN only (`stun:stun.l.google.com:19302`), sent to clients in the `hello` message. Set
  the `ICE_SERVERS` environment variable to a JSON array of `RTCIceServer` objects to add a TURN server later
  (there isn't one yet, so friends behind strict/symmetric NATs — many phone hotspots, some corporate or
  carrier-grade NATs — may fail to connect to each other even though the signaling worked fine). On a
  `CAMP_PASSWORD`-protected server `hello` (and the `iceServers` it carries) is withheld until the socket
  authenticates, same as the rest of the world state — see "Running it publicly" above.
- **Positional audio**: each remote voice is piped through a WebAudio `PannerNode` (HRTF, linear falloff,
  full volume out to 4m, silent past ~36m — close to the text chat's 30m range) into its own **Voice chat**
  volume bus (Options screen, alongside Master/Effects/Music) under the game's master volume, so **M** (mute
  sound) mutes voices too. The panner's position is updated from that player's rendered position every
  frame (this also covers players inside a tent, which is really just standing a few meters lower — voices
  work the same there), and the listener follows the camera. Chrome needs the incoming stream attached to a
  real (but muted) `<audio>` element as well as WebAudio, or it can stay silent — the code does both.
- **Who connects to whom**: a client only opens a connection to players within 60m, and drops it past 80m
  (the gap between the two is hysteresis, so walking back and forth at the edge doesn't thrash connections).
  That keeps a full camp from trying to hold everyone-to-everyone connections when most players are far
  enough apart to be inaudible anyway. Whichever of the two has the lower connection id sends the offer, so
  both sides never try to initiate at once.
- **Opt-in**: mic access is only requested when a player turns voice on (a HUD button, bottom right), and a
  peer only answers another player's connection offer while its own voice is on — so nobody hears anyone
  without turning their own mic control on first. Denied mic permission shows a toast and leaves the rest of
  the game untouched.
- **Controls**: push-to-talk on **B** (hold) by default, or toggle to always-on mic; a separate "mute voices"
  toggle silences everyone else without touching game sound. Push-to-talk is rebindable from the pause
  menu's Options screen like any other key.
