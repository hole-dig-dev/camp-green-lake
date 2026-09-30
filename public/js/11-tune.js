'use strict';
/* public/js/11-tune.js -- the tuning registry behind the play-tester's control center (77-tune-panel.js).
   Every knob the tester can move lives in TUNE_DEFS. Game code reads the live value with tune('key').

   Sliders are always centered on the default: the middle of the track IS the default, so after the tester says
   "make these the new defaults" we edit `def` here and every slider snaps back to the middle with the new value.
     kind 'mul': a multiplier-style number, log scale from def/range (far left) to def*range (far right).
                 zero:true lets the far-left notch mean 0 (off).
     kind 'lin': a plain number from def-span to def+span, clamped to [min,max]. int:true rounds it to whole numbers.
     fmt: optional v=>text for how the value reads (e.g. an angle in radians shown as degrees).
   Saved overrides remember the default they were set against. When a default changes in code, the old override
   is dropped, so baking a value in can never leave a stale slider behind. */
const TUNE_DEFS=[
  // ---- finds: the item that pops out of your hole
  {key:'loot.carryOdds',tab:'Finds',label:'Finds too big for the sack (carried): chance in a shallow hole',def:0.33,kind:'lin',span:0.33,min:0,max:1,unit:'%',pct:true},
  {key:'loot.carryDeep',tab:'Finds',label:'…extra chance at the deepest (a 5 ft hole)',def:0.25,kind:'lin',span:0.25,min:0,max:1,unit:'%',pct:true},
  {key:'loot.carryValue',tab:'Finds',label:'Carried find worth (× its sack value, +10)',def:2.5,kind:'mul',range:3,unit:'×'},
  {key:'finds.smallScale',tab:'Finds',label:'Common find size (cap, can, spoon…)',def:3,kind:'mul',range:4,unit:'×'},
  {key:'finds.bigScale',tab:'Finds',label:'Big find size (safe, strongbox, KB, suitcase)',def:1,kind:'mul',range:4,unit:'×'},
  {key:'finds.rise',tab:'Finds',label:'How high it floats up',def:1.04,kind:'lin',span:2,min:0,unit:' m'},
  {key:'finds.start',tab:'Finds',label:'Where it starts (above the hole floor)',def:0.2,kind:'lin',span:1,min:-1,unit:' m'},
  {key:'finds.riseTime',tab:'Finds',label:'Time to float up',def:1,kind:'mul',range:4,unit:' s'},
  {key:'finds.hold',tab:'Finds',label:'Time before it shrinks away',def:2.2,kind:'mul',range:4,unit:' s'},
  {key:'finds.spin',tab:'Finds',label:'Spin speed',def:4,kind:'mul',range:4,zero:true,unit:' rad/s'},
  // ---- damage: hurt() multiplies by the overall slider and the one for that source
  {key:'dmg.all',tab:'Damage',label:'All damage',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'dmg.Twister',tab:'Damage',label:'Twister',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'dmg.Landslide',tab:'Damage',label:'Landslide boulders',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'dmg.Tumbleweed',tab:'Damage',label:'Tumbleweed',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'dmg.Bitten',tab:'Damage',label:'Javelina bite',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'dmg.Mountain lion',tab:'Damage',label:'Mountain lion pounce',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'dmg.Vulture',tab:'Damage',label:'Vulture drop',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'dmg.Lizard hatchling',tab:'Damage',label:'Lizard hatchling bite (poison)',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'dmg.Rattlesnake',tab:'Damage',label:'Rattlesnake strike (poison)',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'dmg.Scorpion',tab:'Damage',label:'Scorpion sting (poison)',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'hp.thirst',tab:'Damage',label:'Thirst: health lost per second once your water runs out',def:4,kind:'mul',range:4,zero:true,unit:' hp/s'},
  {key:'water.last',tab:'Damage',label:'Water lasts (how long a full canteen goes, vs the original)',def:3,kind:'mul',range:4,unit:'×'},   // JT: water lasts 3x longer by default
  {key:'hp.healRate',tab:'Damage',label:'Injuries heal',def:1.5,kind:'mul',range:4,zero:true,unit:' hp/s'},
  {key:'hp.healDelay',tab:'Damage',label:'Wait before injuries start healing',def:5,kind:'mul',range:4,unit:' s'},
  // ---- stamina and afflictions (70-player.js)
  {key:'stam.sprint',tab:'Stamina',label:'Sprinting costs',def:14,kind:'mul',range:4,zero:true,unit:'/s'},
  {key:'stam.carry',tab:'Stamina',label:'Hauling costs (while moving)',def:4,kind:'mul',range:4,zero:true,unit:'/s'},
  {key:'stam.jump',tab:'Stamina',label:'A jump costs',def:5,kind:'mul',range:4,zero:true,unit:''},
  {key:'stam.regen',tab:'Stamina',label:'Recovery standing still',def:20,kind:'mul',range:4,unit:'/s'},
  {key:'stam.regenMove',tab:'Stamina',label:'Recovery while walking',def:10,kind:'mul',range:4,zero:true,unit:'/s'},
  {key:'aff.burn',tab:'Stamina',label:'Sunburn builds (10:00-17:00, no shade)',def:0.05,kind:'mul',range:6,zero:true,unit:'/s'},
  {key:'aff.burnMax',tab:'Stamina',label:'Sunburn can take up to',def:35,kind:'lin',span:35,min:0,max:100,unit:''},
  {key:'aff.heatRecover',tab:'Stamina',label:'Heatstroke fades (with water)',def:0.6,kind:'mul',range:4,unit:'/s'},
  {key:'aff.poisonFade',tab:'Stamina',label:'Poison wears off',def:0.2,kind:'mul',range:4,unit:'/s'},
  {key:'aff.hunger',tab:'Stamina',label:'Hunger builds (daytime)',def:0.03,kind:'mul',range:6,zero:true,unit:'/s'},
  {key:'aff.hungerMax',tab:'Stamina',label:'Hunger can take up to',def:40,kind:'lin',span:40,min:0,max:100,unit:''},
  // ---- grabbing heavy loot (84-grab.js)
  {key:'grab.fmax',tab:'Grab',label:'How hard one camper can pull (the safe is ~1180 N)',def:700,kind:'mul',range:3,unit:' N'},
  {key:'grab.throw',tab:'Environment',label:'Throw strength (heavy loot, bodies)',def:1,kind:'mul',range:4,unit:'×'},
  {key:'stam.rope',tab:'Grab',label:'Pulling a taut rope costs (stamina)',def:5,kind:'mul',range:4,zero:true,unit:'/s'},
  {key:'grab.cartTip',tab:'Grab',label:'Wheelbarrow tips over above (speed)',def:1,kind:'mul',range:3,unit:'×'},
  {key:'grab.fragile',tab:'Grab',label:'How much bumps chip off the value',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  // ---- other maps (88-zones.js, 89-zone-canyon.js)
  {key:'zone.fallSafe',tab:'Maps',label:'Falls start to hurt above (landing speed)',def:11,kind:'mul',range:2,unit:' m/s'},
  {key:'zone.fallDmg',tab:'Maps',label:'Fall damage per m/s over that',def:7,kind:'mul',range:4,zero:true,unit:''},
  {key:'zone.legup',tab:'Maps',label:'Leg-up jump speed (a crouching friend)',def:8.2,kind:'mul',range:1.6,unit:' m/s'},
  {key:'zone.legupR',tab:'Maps',label:'Leg-up: how close to a crouching friend',def:1.3,kind:'mul',range:2,unit:' m'},
  {key:'zone.stepRise',tab:'Maps',label:'Tallest step you walk up without jumping',def:0.55,kind:'mul',range:2,unit:' m'},
  {key:'zone.fireR',tab:'Maps',label:'Campfire: how close counts as at the fire (also "home" for a carried friend)',def:1,kind:'mul',range:3,unit:'×'},
  {key:'zone.ropeSlow',tab:'Maps',label:'Climbing a dropped rope: walking speed',def:0.35,kind:'mul',range:3,unit:'×'},
  // ---- you: moving and digging (70-player.js, 45-state.js)
  {key:'move.walk',tab:'Player',label:'Walking speed',def:4.3,kind:'mul',range:2,unit:' m/s'},
  {key:'move.sprint',tab:'Player',label:'Sprinting speed',def:7.2,kind:'mul',range:2,unit:' m/s'},
  {key:'move.crouch',tab:'Player',label:'Crouching speed',def:2,kind:'mul',range:2,unit:' m/s'},
  {key:'move.jump',tab:'Player',label:'Jump (take-off speed; 5.6 is about 1 m)',def:5.6,kind:'mul',range:1.6,unit:' m/s'},
  {key:'dig.time',tab:'Player',label:'Time per shovel scoop',def:0.42,kind:'mul',range:3,unit:' s'},
  {key:'dig.depth',tab:'Player',label:'How deep each scoop goes',def:1,kind:'mul',range:3,unit:'×'},
  // ---- ragdolls (26-ragdoll.js) and what throws you around
  {key:'rag.flop',tab:'Ragdoll',label:'How floppy arms and legs are',def:1,kind:'mul',range:3,unit:'×'},
  {key:'rag.flail',tab:'Ragdoll',label:'Arm flailing in the air',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'rag.fallKnock',tab:'Ragdoll',label:'A landing this fast knocks you flat',def:11,kind:'mul',range:2,unit:' m/s'},
  {key:'rag.knockTime',tab:'Ragdoll',label:'Knocked flat for',def:1.4,kind:'mul',range:3,unit:' s'},
  {key:'rag.getup',tab:'Ragdoll',label:'Getting back up takes',def:1.4,kind:'mul',range:3,unit:' s'},
  {key:'rag.twister',tab:'Environment',label:'Twister throw strength',def:1,kind:'mul',range:2.5,unit:'×'},
  {key:'rag.bonk',tab:'Environment',label:'Shovel bonk launch',def:1,kind:'mul',range:3,zero:true,unit:'×'},
  // ---- the environment: hazards and reach. Random things (each twister's strength, each tumbleweed's size and speed)
  // stay random; these scale them, or set the fixed parts.
  {key:'env.twStrength',tab:'Environment',label:'Twister: wind strength (scales each one\'s random strength)',def:1,kind:'mul',range:2.5,zero:true,unit:'×'},
  {key:'env.twReach',tab:'Environment',label:'Twister: how far out the wind pulls you',def:25,kind:'mul',range:2.5,unit:' m'},
  {key:'env.twGrab',tab:'Environment',label:'Twister: grab radius (lifts you off your feet)',def:6,kind:'mul',range:3,unit:' m'},
  {key:'env.twPull',tab:'Environment',label:'Twister: pull toward the core',def:11,kind:'mul',range:3,zero:true,unit:' m/s'},
  {key:'env.twSpin',tab:'Environment',label:'Twister: swirl around it',def:7.5,kind:'mul',range:3,zero:true,unit:' m/s'},
  {key:'env.twSuckTime',tab:'Environment',label:'Twister: time spun up before the throw',def:1.1,kind:'mul',range:3,unit:' s'},
  {key:'env.twRise',tab:'Environment',label:'Twister: how high it lifts you',def:10,kind:'mul',range:3,unit:' m'},
  {key:'env.twDown',tab:'Environment',label:'Twister: lying there after landing',def:1.4,kind:'mul',range:3,unit:' s'},
  {key:'env.twSpeed',tab:'Environment',label:'Twister: how fast it wanders across the lake',def:3.2,kind:'mul',range:3,unit:' m/s'},
  {key:'env.tbSize',tab:'Environment',label:'Tumbleweed: size (scales the random 4-7 m)',def:1,kind:'mul',range:2,unit:'×'},
  {key:'env.tbSpeed',tab:'Environment',label:'Tumbleweed: speed (scales the random 10-16 m/s)',def:1,kind:'mul',range:2.5,unit:'×'},
  {key:'env.tbBounce',tab:'Environment',label:'Tumbleweed: bounce height (the kick every landing)',def:4,kind:'mul',range:2.5,unit:' m/s'},
  {key:'env.tbRide',tab:'Environment',label:'Tumbleweed: longest ride before it flings you',def:7,kind:'mul',range:3,unit:' s'},
  {key:'env.tbMash',tab:'Environment',label:'Tumbleweed: Space presses to wriggle free',def:6,kind:'lin',span:5,min:1,max:20,unit:''},
  {key:'env.tbDown',tab:'Environment',label:'Tumbleweed: lying there after it lets go',def:1,kind:'mul',range:3,unit:' s'},
  {key:'env.grabReach',tab:'Environment',label:'Grab reach (hold R on loot, a friend, the wheelbarrow)',def:4.5,kind:'mul',range:2,unit:' m'},
  {key:'env.bonkReach',tab:'Environment',label:'Shovel bonk reach',def:2.3,kind:'mul',range:2,unit:' m'},
  // ---- monsters, events and the curse (the server reads these too, from the play-test server's saved sliders)
  {key:'cart.spillKo',tab:'Grab',label:'Tipped out of the wheelbarrow while downed: knockout time lost',def:6,kind:'mul',range:3,zero:true,unit:' s'},
  {key:'ro.sheriffWin',tab:'Monsters',label:'The Sheriff\'s ghost hunts loot carriers in the last part of the day',def:0.15,kind:'lin',span:0.15,min:0,max:1,unit:'%',pct:true},
  {key:'mon.hatchBite',tab:'Monsters',label:'Lizard hatchling bite (poison)',def:8,kind:'mul',range:3,unit:' hp'},
  {key:'aff.poisonHold',tab:'Monsters',label:'Poison stops wearing off for this long after a bite',def:4,kind:'mul',range:3,zero:true,unit:' s'},
  {key:'mon.roster',tab:'Monsters',label:'Roster monsters spawn rate',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'mon.events',tab:'Monsters',label:'Hazard events (twisters, storms…) happen',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'curse.ko',tab:'Monsters',label:'Curse: per knockout',def:4,kind:'mul',range:4,zero:true,unit:'%'},
  {key:'curse.curfew',tab:'Monsters',label:'Curse: per camper outside at curfew',def:5,kind:'mul',range:4,zero:true,unit:'%'},
  {key:'curse.dawn',tab:'Monsters',label:'Curse: eases each dawn by',def:3,kind:'mul',range:4,zero:true,unit:'%'},
  {key:'curse.quota',tab:'Monsters',label:'Curse: eases when the quota is met by',def:10,kind:'mul',range:3,zero:true,unit:'%'},
  {key:'curse.lullaby',tab:'Monsters',label:'Curse: eases when Zeroni is sung away by',def:20,kind:'mul',range:3,zero:true,unit:'%'},
  {key:'mood.heat',tab:'Monsters',label:'Heatwave: water drain',def:1.6,kind:'mul',range:2,unit:'×'},
  // ---- creatures
  {key:'vulture.attract',tab:'Creatures',label:'Vultures start circling below',def:0.55,kind:'lin',span:0.45,min:0,max:1,unit:'% hp',pct:true},
  {key:'vulture.thresh',tab:'Creatures',label:'Vultures target you below',def:0.30,kind:'lin',span:0.30,min:0,max:1,unit:'% hp',pct:true},
  {key:'vulture.clear',tab:'Creatures',label:'Vultures give up above',def:0.40,kind:'lin',span:0.40,min:0,max:1,unit:'% hp',pct:true},
  {key:'vulture.height',tab:'Creatures',label:'Vulture: how high it carries you (each carry varies ±15%)',def:7.25,kind:'mul',range:4,unit:' m'},
  {key:'vulture.dist',tab:'Creatures',label:'Vulture: how far it carries you (varies ±20%)',def:18,kind:'mul',range:4,unit:' m'},
  {key:'vulture.carry',tab:'Creatures',label:'Vulture: carries you for (longer if it has to climb higher)',def:2.6,kind:'mul',range:3,unit:' s'},
  {key:'vulture.fallDmg',tab:'Creatures',label:'Vulture: most damage the drop can do',def:25,kind:'mul',range:4,zero:true,unit:' hp'},
  {key:'vulture.grace',tab:'Creatures',label:'Vulture: seconds hurt before it starts circling you',def:4,kind:'mul',range:4,unit:' s'},
  {key:'vulture.warn',tab:'Creatures',label:'Vulture: circles you this long before diving',def:5,kind:'mul',range:4,unit:' s'},
  {key:'vulture.dive',tab:'Creatures',label:'Vulture: the dive takes (longer = easier to shoo)',def:1.3,kind:'mul',range:3,unit:' s'},
  {key:'vulture.down',tab:'Creatures',label:'Vulture: you lie there after the drop for',def:1.3,kind:'mul',range:3,unit:' s'},
  {key:'vulture.cool',tab:'Creatures',label:'Vulture: leaves you alone after a drop for',def:32,kind:'mul',range:4,unit:' s'},
  // ---- audio: each multiplies that sound's own mix level (the pause menu's Master/Effects still apply on top)
  {key:'vol.wind',tab:'Audio',label:'Wind',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'vol.crickets',tab:'Audio',label:'Crickets (night)',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'vol.radio',tab:'Audio',label:'Walkie-talkie voices (friends out of earshot)',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'vol.calls',tab:'Audio',label:'Desert calls (hawk, dove, coyotes, owl)',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'vol.rain',tab:'Audio',label:'Rain',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'vol.steps',tab:'Audio',label:'Footsteps',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'vol.dig',tab:'Audio',label:'Digging',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'vol.metal',tab:'Audio',label:'Metal clink (find coming)',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'vol.props',tab:'Audio',label:'Doors and cloth',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'vol.synth',tab:'Audio',label:'Beeps, chimes and thuds',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  // ---- curfew: the police patrol and the watchtower searchlights. The curfew.* keys named in SIM.CURFEW_DEF (sim.js)
  // are shared rules: the play-test server runs them and sends everyone its values. towerGlow/copLight are just the look.
  {key:'curfew.towerReach',tab:'Curfew',label:'Searchlight reach (where the far edge lands)',def:SIM.CURFEW_DEF.towerReach,kind:'mul',range:3,unit:' m'},
  {key:'curfew.towerHalf',tab:'Curfew',label:'Searchlight width',def:SIM.CURFEW_DEF.towerHalf,kind:'mul',range:3,fmt:v=>tuneDeg(v*2)+' wide'},
  {key:'curfew.towerSweep',tab:'Curfew',label:'Searchlight swing (either side of its aim)',def:SIM.CURFEW_DEF.towerSweep,kind:'mul',range:3,zero:true,fmt:v=>v?'±'+tuneDeg(v):'fixed'},
  {key:'curfew.towerSpeed',tab:'Curfew',label:'Searchlight sweep speed',def:SIM.CURFEW_DEF.towerSpeed,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'curfew.towerGlow',tab:'Curfew',label:'Searchlight brightness',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'curfew.copN',tab:'Curfew',label:'Police officers on patrol',def:SIM.CURFEW_DEF.copN,kind:'lin',span:8,min:0,max:12,int:true,fmt:v=>v?v+' officer'+(v===1?'':'s'):'none'},
  {key:'curfew.copRing',tab:'Curfew',label:'Patrol loop size (1× ≈ 94 m from camp)',def:SIM.CURFEW_DEF.copRing,kind:'mul',range:2.5,unit:'×'},
  {key:'curfew.copRange',tab:'Curfew',label:'Flashlight reach',def:SIM.CURFEW_DEF.copRange,kind:'mul',range:3,unit:' m'},
  {key:'curfew.copHalf',tab:'Curfew',label:'Flashlight width',def:SIM.CURFEW_DEF.copHalf,kind:'mul',range:2.5,fmt:v=>tuneDeg(v*2)+' wide'},
  {key:'curfew.copLight',tab:'Curfew',label:'Flashlight brightness',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'curfew.copWalk',tab:'Curfew',label:'Patrol walking speed',def:SIM.CURFEW_DEF.copWalk,kind:'mul',range:3,unit:' m/s'},
  {key:'curfew.copRun',tab:'Curfew',label:'Chase speed (you sprint at 7.2)',def:SIM.CURFEW_DEF.copRun,kind:'mul',range:2,unit:' m/s'},
  {key:'curfew.copLose',tab:'Curfew',label:'Time before they give up the chase',def:SIM.CURFEW_DEF.copLose,kind:'mul',range:4,unit:' s'},
  {key:'curfew.copCatch',tab:'Curfew',label:'Catch distance',def:SIM.CURFEW_DEF.copCatch,kind:'mul',range:3,unit:' m'},
];
function tuneDeg(rad){return Math.round(rad*180/Math.PI)+'°'}
const TUNE_BY=Object.fromEntries(TUNE_DEFS.map(d=>[d.key,d]));
const TUNE_KEY='cgl-tune';
let TUNE_OVR={};   // key -> {v, def}: only the knobs the tester has moved
function tune(key){const o=TUNE_OVR[key];return o?o.v:TUNE_BY[key].def}
function tuneOr(key,fallback){return TUNE_BY[key]?tune(key):fallback}

/* slider position (-1..1, 0 = default) <-> value */
function tuneFromPos(d,p){
  if(d.kind==='mul'){if(d.zero&&p<=-0.999)return 0;return d.def*Math.pow(d.range,p)}
  const v=clamp(d.def+p*d.span,d.min??-Infinity,d.max??Infinity);return d.int?Math.round(v):v;
}
function tuneToPos(d,v){
  if(d.kind==='mul'){if(v<=0)return-1;return clamp(Math.log(v/d.def)/Math.log(d.range),-1,1)}
  return clamp((v-d.def)/d.span,-1,1);
}

function tuneAdopt(o){   // keep only overrides for knobs that still exist and whose default hasn't moved since
  const out={};
  if(o&&typeof o==='object')for(const k in o){const d=TUNE_BY[k],e=o[k];
    if(d&&e&&Number.isFinite(e.v)&&e.def===d.def&&e.v!==d.def)out[k]={v:e.v,def:d.def}}
  return out;
}
function tuneSaveLocal(){try{localStorage.setItem(TUNE_KEY,JSON.stringify(TUNE_OVR))}catch(e){}}
try{TUNE_OVR=tuneAdopt(JSON.parse(localStorage.getItem(TUNE_KEY)||'null'))}catch(e){}
curfewFromTune();

/* The play-test server (DEV_MODE=1) also keeps a copy in data/tune.json, so Claude can read the tester's values and
   bake them in as new defaults. The server's copy wins on load; on a normal server /tune is a 404 and this is a no-op. */
fetch('/tune',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(o=>{if(o){TUNE_OVR=tuneAdopt(o);tuneSaveLocal();curfewFromTune();if(typeof tuneApplyAll==='function')tuneApplyAll()}}).catch(()=>{});
let tuneSyncT=0;
/* Solo play runs the police and searchlights in the page, so the Curfew tab applies straight to SIM.CURFEW. Online the
   server runs them: it applies the saved values and sends them back to everyone (the 'curfew' message in 65-net.js). */
function curfewFromTune(){
  if(typeof online==='function'&&online())return;
  const v={};for(const k in SIM.CURFEW_DEF)v[k]=tuneOr('curfew.'+k,SIM.CURFEW_DEF[k]);SIM.setCurfew(v);
}
function tuneSync(){
  tuneSaveLocal();curfewFromTune();
  clearTimeout(tuneSyncT);
  tuneSyncT=setTimeout(()=>fetch('/tune',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(TUNE_OVR)})
    .then(r=>r.ok,()=>false).then(ok=>{const el=document.getElementById('tuneSaved');if(el)el.textContent=ok?'Saved to the test server ✓':'Saved in this browser only'}),400);
}
function tuneSet(key,v){
  const d=TUNE_BY[key];if(!d)return;
  if(v===d.def)delete TUNE_OVR[key];else TUNE_OVR[key]={v,def:d.def};
  tuneSync();
}
