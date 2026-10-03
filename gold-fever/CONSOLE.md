# Hidden command console

Enter the goldfield, then press **~** (or the backtick key, usually below Esc). Type a command and press Enter. **~** or **Esc** closes the console. It has no button in the gameplay HUD. **Up/Down** recalls commands, **Tab** completes names, and `clear` clears the output.

Any joined player can use it in this private prototype. Cash belongs to the crew. Money, equipment and bookmarks are saved; flight, speed, jump and tumble protection reset when the host restarts. `reset` restores normal movement immediately without removing cash or gear.

## Quick start

```text
money 100000
give all
tp creek
spawn excavator
spawn truck
spawn washplant
fly on
speed 3
safe on
```

Vehicle spawns print their IDs and locations. Use `tp ID`, close the console, then F to drive. Washer kits from `give all` can also be placed normally with B. Washing remains necessary for gold inside test gravel.

## Money

| Command | Effect |
| --- | --- |
| `money 10000` | Add $10,000 to the shared treasury |
| `money add 500` | Add $500; `cash 500` is an alias |
| `money set 100000` | Set the shared treasury to $100,000 |
| `gold 100` | Put 100 grams of recovered gold in your own pouch |
| `bank` / `sell` | Sell your pouch from anywhere at the normal assay rate |

## Traversal and recovery

| Command | Effect |
| --- | --- |
| `tp camp` / `tp shop` / `tp assay` | Go to town destinations |
| `tp creek` / `tp ghost` / `tp fox` | Go to creek, Ghost Bend or Fox Hill |
| `tp pay1` through `tp pay4` | Go to one of the four generated gold deposits |
| `tp 50 -30` | Teleport to X=50, Z=-30 at ground level |
| `tp 50 -30 25` | Teleport to X=50, Z=-30, absolute Y=25 metres |
| `tp @"Pickaxe Pete"` | Go beside a friend with that name |
| `tp v2` / `tp m3` / `tp c1` | Go beside equipment using its printed ID |
| `back` | Return to your previous teleport position |
| `mark claim` / `marks` / `tp claim` | Save, list and visit personal bookmarks |
| `fly on` / `fly off` / `noclip` | Enable, disable or toggle flight through obstacles |
| `speed 3` / `speed 1` | Set walking/flight speed multiplier or restore normal speed |
| `jump 3` / `jump 1` | Set jump multiplier or restore normal jump |
| `safe on` / `safe off` | Prevent or permit tumbles; `god` is an alias |
| `recover` / `heal` / `unstuck` | Get up and move to safe ground |
| `reset` | Restore ordinary movement and land safely |

In flight, **WASD** moves along your view, **Space** goes up, **Ctrl** goes down, and **Shift** goes faster. Flight remains inside the existing 224 × 224 metre map. X is east/west; Z is south/north; negative Z is north. Teleporting parks/releases your equipment and returns a pending pan parcel to your bucket.

`safe` protects against the current recoverable tumbles. A survival/death system has not been added. Speed affects walking and flight, rather than vehicle handling.

## Equipment and testing

| Command | Effect |
| --- | --- |
| `give all` | All personal upgrades, washer kits and purchase unlocks; vehicles are spawned separately |
| `give sieve` / `give shovel` / `give bucket` / `give boots` | Grant a personal upgrade |
| `give rocker` / `give sluice` / `give washplant` | Grant a washer kit |
| `unlock all` / `unlock truck` | Bypass purchase prerequisites |
| `spawn wheelbarrow` | Create another parked wheelbarrow |
| `spawn rocker` / `spawn sluice` / `spawn washplant` | Place a washer; distant washers are placed beside the creek |
| `spawn excavator` / `spawn truck` / `spawn hydraulic` | Create a vehicle near you |
| `fill` | Fill the held vehicle/cart or personal bucket with test gravel |
| `fill 180 10` | Add up to 180 kg of gravel containing 10 grams of raw gold; capacity limits still apply |
| `time 12` / `day 5` | Set the simulation clock/day; lighting does not change |
| `where` / `status` | Coordinates, map size, cash and cheat settings |
| `players` / `equipment` | Crew and equipment IDs/locations |
| `help` | Full list; `help travel`, `help money`, `help gear`, `help info` show a group |

Amounts are bounded, equipment has a 40-entity limit, and commands are parsed by the authoritative host. Commands are game actions; the console does not execute JavaScript or shell commands.
