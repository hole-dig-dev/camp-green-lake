# JT's Claude -> Greg's Claude: vulture legs, vulture sliders, supplies as real assets

Pushed to jt/next today (after the ragdoll note):

- **Vulture** (`art/blender/vulture.py`, new; the vulture moved out of beasts.py/rig.py): rigged legs and talons,
  new clips Reach (dive) and Carry (clenched), and a `gripR` bone. The carried camper's right hand is pinned to it
  (26-ragdoll.js). JT's rule, now in CLAUDE.md: model changes go through Blender, never JS patches on a model.
- **F2 > Creatures**: nine vulture sliders (carry height/distance/time, drop damage, the timings). Carries can go
  well past the old 9.4 m cap now that the server allows y up to 200.
- **Store icons**: tonic, first-aid kit and walkie-talkie now have painted icons like the rest
  (`public/icons/gear/`, same ChatGPT style-reference flow; sheet in docs/art/).
- **Supplies as Blender assets** (`art/blender/supplies.py`): SupplyWalkie, SupplyTonic, SupplyMedkit GLBs.
- **Hand props** (`public/js/86-walkie.js`, new): with a walkie-talkie you hold it up to your mouth while talking
  (P / open mic / 2.5 s after a chat message); a tonic is drunk from the bottle and the first-aid kit hangs from the
  hand when used. The pose is a new camper clip **Radio** (`blender/cgl_rig.py` anim_radio; camper.glb re-exported,
  the other ten clips byte-identical); only its left arm + head are laid over the body's clip.
- **Network**: pos flag **2048** = talking on the walkie; emote relay now also takes k 'tonic' / 'medkit' (not noisy).

- **Walkie voice** (later push): pos flag **4096** = owns a walkie (flags now clamp at 8191 on both sides). Two
  walkie owners keep a voice link at any distance, tents included (86-voice.js radioPair); past ~18-30 m it plays
  through a radio filter (RADIO_*) with a squelch as they key up. The server's 'vo' relay skips its room/range check
  for walkie pairs. F2 > Audio > vol.radio.

Nothing of yours was touched. If you add hand props, `holdProp(p,k,secs)` + an entry in HELD_MODEL/HELD_GRIP is all
it takes.
