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

Other admin endpoints (same header): `/admin/who` lists who's connected.

## Developer console

Press **`** (the key left of 1) in game to open the console, or tap the **>_** button on a touch screen. Type `help` for the full list. Commands are case-insensitive:

| Command | What it does |
|---|---|
| `twister [distance]` | Spawn a twister ~45 m in front of you, heading your way. Everyone in camp sees it. |
| `time <hh:mm>` | Set the camp clock for everyone, e.g. `time 13:00`. |
| `heal` / `hurt [n]` | Refill health and water / take damage. |
| `tp <x> <z>` / `tp camp` | Teleport. |
| `where` | Print your position. |

Only the host can use it on a normal server. Run the server with `DEV_MODE=1` (the play-test server does) to give everyone host powers, including the console and the hidden `sploosh` admin panel. Solo offline play can always use it.

**Adding a command:** one line near the other `command(...)` calls in `public/index.html`:
`command('name', {usage: 'name <arg>', help: 'what it does', run(args) { ...; return 'reply'; }})`

**Adding a spawnable hazard:** add an entry to the `ENV` registry (`ENV.sandstorm = {spawn: o => ...}`, where `o` is `{x, z, a}`) and a command that calls `spawnAhead('sandstorm', dist)`. The server relays hazards spawned by the host, so every client builds the same one.

## How it's built

- `public/index.html`: the whole game in one file. Three.js (r128) for rendering, WebAudio for sound effects and music, no build step.
- `server.js`: a small Node server using `ws`. It relays player positions, digs, and shouts, and keeps the shared world state.
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
  carrier-grade NATs — may fail to connect to each other even though the signaling worked fine).
- **Positional audio**: each remote voice is piped through a WebAudio `PannerNode` (HRTF, linear falloff,
  full volume out to 4m, silent past ~36m — close to the text chat's 30m range) under the game's existing
  master volume bus, so **M** (mute sound) mutes voices too. The panner's position is updated from that
  player's rendered position every frame, and the listener follows the camera. Chrome needs the incoming
  stream attached to a real (but muted) `<audio>` element as well as WebAudio, or it can stay silent — the
  code does both.
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
  toggle silences everyone else without touching game sound.
