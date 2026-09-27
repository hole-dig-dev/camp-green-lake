# Camp Green Lake

A multiplayer browser digging game set in the dry lake bed from *Holes*. Dig five-foot holes, sell what you find to Mr. Sir, dodge yellow-spotted lizards, and work with your friends to find what Kissin' Kate Barlow buried.

Inspired by the co-op digging game *Needle In A Haystack*: a huge search area, one buried prize, and a group of friends arguing about where to dig.

## Play

- **WASD** walk, **Shift** run, **Space** jump
- **Click** to lock the mouse, then **hold click** (or **E**) to dig
- **F** talk, buy, sell, or sit down at the card table
- **Q** eat an onion (lizards won't come near you for 45 seconds)
- **1–5** shout at your friends, **T** toggle the metal detector, **M** sound

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

Other admin endpoints (same header): `/admin/who` lists who's connected.

## How it's built

- `public/index.html`: the whole game in one file. Three.js (r128) for rendering, WebAudio for sound effects and music, no build step.
- `server.js`: a small Node server using `ws`. It relays player positions, digs, and shouts, and keeps the shared world state.
- The lake bed is a 301×301 heightmap. Each hole is stored as a center and a depth, and the terrain around it is rebuilt when someone digs, so holes (and the dirt piles next to them) sync between players as a few bytes each.
- Buried items come from a seeded random generator, so every player has the same camp without the server sending the item list.
