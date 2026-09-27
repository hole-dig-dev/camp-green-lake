# Camp Green Lake

A multiplayer browser digging game set in the dry lake bed from *Holes*. Dig five-foot holes, sell what you find to Mr. Sir, dodge yellow-spotted lizards, and work with your friends to find what Kissin' Kate Barlow buried.

Inspired by the co-op digging game *Needle In A Haystack*: a huge search area, one buried prize, and a group of friends arguing about where to dig.

## Play

- **WASD** walk, **Shift** run, **Space** jump
- **Click** to lock the mouse, then **hold click** (or **E**) to dig
- **F** talk, buy, sell, or sit down at the card table
- **Q** eat an onion (lizards won't come near you for 45 seconds)
- **1–5** shout at your friends, **T** toggle the metal detector, **M** sound
- **Esc** pauses (a touch-screen game gets a small pause button in the HUD instead): Resume, Options, Controls, Restart (respawns you at camp; keeps your seeds, gear, and the team's progress), or Quit to title. The game keeps running for everyone else while you're paused.

In Options you can adjust mouse sensitivity, invert Y, touch look speed, field of view, master/effects/music volume, shadows, render quality, and the FPS counter, and rebind every control except Esc and the console key. Settings and key bindings are saved in the browser (`localStorage`) and reload with you. WASD and the arrow keys always move you, even if you rebind them.

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

The server listens on `127.0.0.1:4300` (set `PORT` to change it). Put it behind a reverse proxy with HTTPS for friends to join. WebSockets are served at `/ws`. Caddy example:

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
