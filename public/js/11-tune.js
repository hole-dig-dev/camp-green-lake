'use strict';
/* public/js/11-tune.js -- the tuning registry behind the play-tester's control center (77-tune-panel.js).
   Every knob the tester can move lives in TUNE_DEFS. Game code reads the live value with tune('key').

   Sliders are always centered on the default: the middle of the track IS the default, so after the tester says
   "make these the new defaults" we edit `def` here and every slider snaps back to the middle with the new value.
     kind 'mul': a multiplier-style number, log scale from def/range (far left) to def*range (far right).
                 zero:true lets the far-left notch mean 0 (off).
     kind 'lin': a plain number from def-span to def+span, clamped to [min,max].
   Saved overrides remember the default they were set against. When a default changes in code, the old override
   is dropped, so baking a value in can never leave a stale slider behind. */
const TUNE_DEFS=[
  // ---- finds: the item that pops out of your hole
  {key:'finds.smallScale',tab:'Finds',label:'Common find size (cap, can, spoon…)',def:3,kind:'mul',range:4,unit:'×'},
  {key:'finds.bigScale',tab:'Finds',label:'Big find size (safe, strongbox, KB, suitcase)',def:1,kind:'mul',range:4,unit:'×'},
  {key:'finds.rise',tab:'Finds',label:'How high it floats up',def:2.4,kind:'lin',span:2.4,min:0,unit:' m'},
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
  {key:'hp.thirst',tab:'Damage',label:'Thirst damage per second',def:4,kind:'mul',range:4,zero:true,unit:' hp/s'},
  {key:'hp.healRate',tab:'Damage',label:'Healing per second',def:1.5,kind:'mul',range:4,zero:true,unit:' hp/s'},
  {key:'hp.healDelay',tab:'Damage',label:'Wait before healing starts',def:5,kind:'mul',range:4,unit:' s'},
  // ---- creatures
  {key:'vulture.attract',tab:'Creatures',label:'Vultures start circling below',def:0.55,kind:'lin',span:0.45,min:0,max:1,unit:'% hp',pct:true},
  {key:'vulture.thresh',tab:'Creatures',label:'Vultures target you below',def:0.30,kind:'lin',span:0.30,min:0,max:1,unit:'% hp',pct:true},
  {key:'vulture.clear',tab:'Creatures',label:'Vultures give up above',def:0.40,kind:'lin',span:0.40,min:0,max:1,unit:'% hp',pct:true},
  // ---- audio: each multiplies that sound's own mix level (the pause menu's Master/Effects still apply on top)
  {key:'vol.wind',tab:'Audio',label:'Wind',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'vol.birds',tab:'Audio',label:'Birds (day)',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'vol.crickets',tab:'Audio',label:'Crickets (night)',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'vol.rain',tab:'Audio',label:'Rain',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'vol.steps',tab:'Audio',label:'Footsteps',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'vol.dig',tab:'Audio',label:'Digging',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'vol.metal',tab:'Audio',label:'Metal clink (find coming)',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'vol.props',tab:'Audio',label:'Doors and cloth',def:1,kind:'mul',range:4,zero:true,unit:'×'},
  {key:'vol.synth',tab:'Audio',label:'Beeps, chimes and thuds',def:1,kind:'mul',range:4,zero:true,unit:'×'},
];
const TUNE_BY=Object.fromEntries(TUNE_DEFS.map(d=>[d.key,d]));
const TUNE_KEY='cgl-tune';
let TUNE_OVR={};   // key -> {v, def}: only the knobs the tester has moved
function tune(key){const o=TUNE_OVR[key];return o?o.v:TUNE_BY[key].def}
function tuneOr(key,fallback){return TUNE_BY[key]?tune(key):fallback}

/* slider position (-1..1, 0 = default) <-> value */
function tuneFromPos(d,p){
  if(d.kind==='mul'){if(d.zero&&p<=-0.999)return 0;return d.def*Math.pow(d.range,p)}
  return clamp(d.def+p*d.span,d.min??-Infinity,d.max??Infinity);
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

/* The play-test server (DEV_MODE=1) also keeps a copy in data/tune.json, so Claude can read the tester's values and
   bake them in as new defaults. The server's copy wins on load; on a normal server /tune is a 404 and this is a no-op. */
fetch('/tune',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(o=>{if(o){TUNE_OVR=tuneAdopt(o);tuneSaveLocal();if(typeof tuneApplyAll==='function')tuneApplyAll()}}).catch(()=>{});
let tuneSyncT=0;
function tuneSync(){
  tuneSaveLocal();
  clearTimeout(tuneSyncT);
  tuneSyncT=setTimeout(()=>fetch('/tune',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(TUNE_OVR)})
    .then(r=>r.ok,()=>false).then(ok=>{const el=document.getElementById('tuneSaved');if(el)el.textContent=ok?'Saved to the test server ✓':'Saved in this browser only'}),400);
}
function tuneSet(key,v){
  const d=TUNE_BY[key];if(!d)return;
  if(v===d.def)delete TUNE_OVR[key];else TUNE_OVR[key]={v,def:d.def};
  tuneSync();
}
