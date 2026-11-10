# Credits for outside assets

Third-party assets used in the game, with their licences. CC-BY assets must stay credited here.

| Asset | Used as | Author | Source | Licence | Changes |
|---|---|---|---|---|---|
| Jeep | `public/models/MrSirTruck.glb` (Foreman Dutch's jeep) | Zsky | https://poly.pizza/m/AcSdGGrgYP | [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/) | Recoloured, rescaled and re-centred by `art/blender/jeep.py`. Original kept at `art/blender/sources/jeep-zsky.glb`. |
| Impact Sounds (10 one-shots used) | `public/audio/coin-1..3.mp3`, `ting.mp3`, `glass.mp3`, `bell.mp3`, `ui-deny.mp3`, `hit-1.mp3`, `hit-2.mp3`, `bodyfall.mp3` (gold, reward, hurt and knockout sounds) | Kenney | https://kenney.nl/assets/impact-sounds | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Trimmed, mono 44.1 kHz MP3, peak-normalised by `asset-library/audio/core-loop/build.sh`; re-pitched at play time. Originals kept at `asset-library/audio/sources/core-loop/`. |
| RPG Audio | `public/audio/coins-pouch.mp3`, `coins-small.mp3`, `leather.mp3`, `latch.mp3`, `ui-open.mp3`, `ui-close.mp3` (coins, store, menus); also the earlier `cloth1.mp3`, `cloth2.mp3`, `doorOpen_1.mp3`, `metalClick.mp3` | Kenney | https://kenney.nl/assets/rpg-audio | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Same conversion. |
| UI Audio | `public/audio/ui-hover.mp3`, `ui-click.mp3` (button sounds) | Kenney | https://kenney.nl/assets/ui-audio | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Same conversion. |
| 40 CC0 water / splash / slime SFX | `public/audio/water-swirl-1..3.mp3`, `water-dunk.mp3` (washing the gold pan) | rubberduck | https://opengameart.org/content/40-cc0-water-splash-slime-sfx | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Same conversion. |

Earlier sound recordings (wind, rain, digging, footsteps, desert calls and so on, all CC0) are credited in [docs/audio-inventory.md](docs/audio-inventory.md#recording-sources-and-license).

## Lake and camp dressing (scatter, landmarks, yard props)

All of these are CC0 models from Poly Pizza, kept as downloaded under `art/blender/sources/dressing/`. `art/blender/dressing.py`
turns them into `public/models/Dress*.glb` (scatter and camp props) and `public/models/Lm*.glb` (landmarks, several models
composed into one scene each): textures and materials dropped and every face repainted in the game's palette as vertex
colours, rescaled to the campers, origin on the ground, some thinned out. The washing line, the tool rack's rail, the
telegraph pole, the gate frame, the trough and the flag pole are plain boxes and posts made in that script. CC0 needs no
credit; they are listed because the authors deserve it.

| Asset | Used in | Author | Source | Licence | Original |
|---|---|---|---|---|---|
| Cactus | DressCactusTall, LmCar | Quaternius | https://poly.pizza/m/HsEJgRLQWX | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/cactus-tall.glb` |
| Cactus Flowers | DressCactusPear | Quaternius | https://poly.pizza/m/Da39rzd54k | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/cactus-pear.glb` |
| Cactus Model | DressCactusBarrel | Isa Lousberg | https://poly.pizza/m/o9BH8qbqfZ | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/cactus-barrel.glb` |
| Grass | DressShrub and several landmarks | Quaternius | https://poly.pizza/m/iw6l7gqcdQ | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/dead-bush.glb` |
| Grass Wispy | DressGrass and several landmarks | Quaternius | https://poly.pizza/m/Msr9zx66VU | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/grass-wispy.glb` |
| Dead Tree | DressDeadTreeA, LmTree | Quaternius | https://poly.pizza/m/16MPvqwlmE | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/dead-tree-a.glb` |
| Dead tree | DressDeadTreeB, LmFence | Kay Lousberg | https://poly.pizza/m/k80NkrvY2f | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/dead-tree-c.glb` |
| Bone | DressBones, LmCar | Quaternius | https://poly.pizza/m/uMs0lDp1u3 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/bone.glb` |
| Large Bone | DressBones, LmTree, LmFence | Quaternius | https://poly.pizza/m/A67un3x9nV | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/ribs.glb` |
| Fish Bone | DressFishBone, LmWreck | Quaternius | https://poly.pizza/m/bU5RLZnq6v | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/fish-bone.glb` |
| Boat | LmWreck, LmPier | Quaternius | https://poly.pizza/m/5UEl54KsuC | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/boat.glb` |
| Sail Boat | LmWreck | Quaternius | https://poly.pizza/m/BgSZXwmm7k | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/sail-boat.glb` |
| Raft Paddle | LmWreck | Quaternius | https://poly.pizza/m/XLwljDJQZ7 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/paddle.glb` |
| Dock Long | LmPier | Quaternius | https://poly.pizza/m/bN9Oz3niNm | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/dock-long.glb` |
| Dock Broken | LmPier | Quaternius | https://poly.pizza/m/1Ve8ZBLSB0 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/dock-broken.glb` |
| Broken Car | LmCar | Quaternius | https://poly.pizza/m/Y67erogmR9 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/broken-car.glb` |
| Broken Cart | LmCamp | Quaternius | https://poly.pizza/m/NBDHe8J7f9 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/broken-cart.glb` |
| Windmill | LmWindmill | Quaternius | https://poly.pizza/m/jpHoi9xDLG | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/windmill.glb` |
| Chair | LmTree | Quaternius | https://poly.pizza/m/iMNqRzPwwe | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/chair.glb` |
| Rock | LmStones | Quaternius | https://poly.pizza/m/4MUaQTcDdc | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/tall-rock.glb` |
| Tent | LmCamp | Quaternius | https://poly.pizza/m/5Q7qIrfDxA | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/tent.glb` |
| Bonfire | LmStones, LmCamp | Quaternius | https://poly.pizza/m/Azj9hJwwwG | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/bonfire.glb` |
| Lantern | DressLantern, LmCamp | Kay Lousberg | https://poly.pizza/m/CtHBJ1ufeW | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/lantern.glb` |
| Barrel | DressBarrel and several landmarks | Quaternius | https://poly.pizza/m/ONdghDBByN | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/barrel.glb` |
| Crate | DressCrate, LmCamp | Quaternius | https://poly.pizza/m/3OEFd1AWfa | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/crate.glb` |
| Fence | LmWindmill, LmFence | Quaternius | https://poly.pizza/m/UXmKfG81fG | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/broken-fence.glb` |
| Shovel | DressToolRack, LmCamp | Quaternius | https://poly.pizza/m/oNBQSf87ZJ | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/shovel.glb` |
| Bucket | DressBucket, LmWindmill, LmTree | Quaternius | https://poly.pizza/m/83obI9bNun | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/bucket.glb` |
| Wooden Sign | LmPier | iPoly3D | https://poly.pizza/m/mxyDWLsKer | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/sign.glb` |
| Rock Large | LmCar, LmTree | Quaternius | https://poly.pizza/m/54jZKTAt5p | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/rock-large.glb` |
| Wood Log | LmCamp | Quaternius | https://poly.pizza/m/L4E32Wee6C | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `sources/dressing/log.glb` |
