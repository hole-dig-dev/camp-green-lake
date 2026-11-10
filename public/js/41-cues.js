'use strict';
/* public/js/41-cues.js -- the core-loop sound pass (2026-11-10): the sounds you hear hundreds of times an hour.
   Gold rewards (coin, nugget, find, assay grade, dig glint, store, quota, level-up), menu sounds, and the most-heard
   danger cues (hurt, knocked out, curfew siren, lizard hiss). Recordings are CC0 one-shots (Kenney, rubberduck; see
   docs/audio-inventory.md) played like a tiny sampler: a metal "ting", a glass "tick" and a bell are re-pitched into
   short rising phrases, so a reward is real struck metal, not an oscillator, and never plays at quite the same pitch
   twice. Everything goes through fxBus (pause menu Effects + Master, M mutes); the start sting follows Music.
   A/B from the console: `audio rewards old|new`, `audio ui old|new`, `audio danger old|new`. "old" is the previous
   synthesized cue (or silence where there was none). Until a clip has decoded, the old cue plays instead.
   NOT yet reviewed by ear by JT: the mix levels below were set by measurement against the approved dig clip. */
Object.assign(AUDIO_FILES,{
  'coin-1':'coin-1.mp3','coin-2':'coin-2.mp3','coin-3':'coin-3.mp3',ting:'ting.mp3',glass:'glass.mp3',bell:'bell.mp3',
  'coins-pouch':'coins-pouch.mp3','coins-small':'coins-small.mp3',leather:'leather.mp3',latch:'latch.mp3',
  'water-swirl-1':'water-swirl-1.mp3','water-swirl-2':'water-swirl-2.mp3','water-swirl-3':'water-swirl-3.mp3','water-dunk':'water-dunk.mp3',
  'ui-open':'ui-open.mp3','ui-close':'ui-close.mp3','ui-hover':'ui-hover.mp3','ui-click':'ui-click.mp3','ui-deny':'ui-deny.mp3',
  'hit-1':'hit-1.mp3','hit-2':'hit-2.mp3',bodyfall:'bodyfall.mp3'
});
Object.assign(AUDIO_MODE,{rewards:'recorded',ui:'recorded',danger:'recorded'});
const cueNew=cat=>AUDIO_MODE[cat]==='recorded';
const cueVol=cat=>tuneOr('vol.'+cat,1);                           // the F2 Audio tab's slider for that family
const cueHave=(...names)=>{let ok=!!AC;for(const n of names)if(!audioBuffers.has(n)){ok=false;if(AC)loadAudioClip(n)}return ok};
const cents=c=>2**((Math.random()*2-1)*c/1200);                   // a random detune of up to +-c cents, as a playback rate
const semi=n=>2**(n/12);
const CUE_TRIM=1.41;   // +3 dB on every cue: the clips are stored peaking at -3 dBFS (asset-library/audio/core-loop/build.sh)
/* one clip. cat: which slider; at: seconds from now (scheduled on the audio clock, so phrases stay tight even when
   the frame rate doesn't); lp: optional low-pass in Hz; bus: where it goes (fxBus unless told otherwise) */
function cue(cat,name,vol=1,rate=1,at=0,lp=0,bus=null){
  if(!AC)return false;const b=audioBuffers.get(name);if(!b){loadAudioClip(name);return false}
  vol*=cueVol(cat)*CUE_TRIM;if(vol<=0)return true;
  const s=AC.createBufferSource(),g=AC.createGain();s.buffer=b;s.playbackRate.value=rate;g.gain.value=vol;
  let f=null;if(lp){f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=lp;f.Q.value=0.7;s.connect(f).connect(g)}else s.connect(g);
  g.connect(bus||fxBus);s.onended=()=>{s.disconnect();g.disconnect();if(f)f.disconnect()};s.start(AC.currentTime+at);return true;
}
/* The sampler's tuning. The recordings ring at about: ting 2980 Hz, glass 1083 Hz, bell 380 Hz. */
const TING_HZ=2980,GLASS_HZ=1083,BELL_HZ=380,TING_G6=1568/TING_HZ,GLASS_ROOT=1,BELL_G4=392/BELL_HZ;
const SFX_OLD={coin:sfx.coin,gold:sfx.gold,find:sfx.find};        // the previous synthesized cues, for `audio rewards old`
let coinN=0,hitN=0,swirlN=0,siftN=0;
Object.assign(sfx,{
  /* ---- gold ---- */
  // a coin's worth of gold. n: how much (optional): bigger payouts are louder and get a second, higher clink
  coin(n=1){
    if(!cueNew('rewards')||!cueHave('coin-1','coin-2','coin-3','coins-small'))return SFX_OLD.coin();
    const k=clamp(Math.log10(1+Math.max(0,n))/2,0.15,1),r=1.55*cents(60);   // k: 0.15 (a fleck) .. 1 (100 gold or more)
    coinN=coinN%3+1;                                              // three different struck-metal takes in turn
    cue('rewards','coin-'+coinN,0.22+0.1*k,r);
    cue('rewards','coins-small',0.5+0.5*k,1.1*cents(80),0.015);
    if(k>0.45)cue('rewards','coin-'+(coinN%3+1),0.15+0.09*k,r*semi(k>0.8?7:5),0.075);
  },
  // a nugget, a rich batch, a badge: a pouch of coins and four struck notes climbing a major chord
  gold(){
    if(!cueNew('rewards')||!cueHave('ting','coins-pouch'))return SFX_OLD.gold();
    const d=cents(40);
    cue('rewards','coins-pouch',0.42,cents(50));
    [0,4,7,12].forEach((s,i)=>cue('rewards','ting',0.26+0.03*i,TING_G6*semi(s)*d,0.04+i*0.085));
  },
  // picked something up: it goes in the sack (leather), with two soft glass notes rising a fourth
  find(){
    if(!cueNew('rewards')||!cueHave('glass','leather'))return SFX_OLD.find();
    const d=cents(50);
    cue('rewards','leather',0.5,cents(120));
    cue('rewards','glass',0.2,GLASS_ROOT*d,0.03);cue('rewards','glass',0.23,GLASS_ROOT*semi(5)*d,0.13);
  },
  // an assay came back Pay dirt (3) or Rich (4): a rising glass sting after the coin sound; Rich climbs further over a bell
  assay(g){
    if(g<3||!cueNew('rewards')||!cueHave('glass','ting','bell'))return;
    const d=cents(25),t0=0.7,rich=g>=4;                           // t0: wait for the coin / nugget cue to finish
    (rich?[0,4,7,12,16]:[0,4,7]).forEach((s,i)=>cue('rewards','glass',(rich?0.26:0.2)+0.02*i,GLASS_ROOT*semi(s)*d,t0+i*0.075));
    cue('rewards','ting',rich?0.26:0.16,GLASS_HZ*semi(rich?19:12)/TING_HZ*d,t0+(rich?5:3)*0.075);   // the top note rings on
    if(rich)cue('rewards','bell',0.32,GLASS_HZ/4/BELL_HZ*d,t0);
  },
  // gold glinting in the dirt you just threw: one or two tiny high ticks, just after the shovel
  glint(n=1){
    if(!cueNew('rewards')||!cueHave('glass'))return;
    const r=2.5*cents(180);cue('rewards','glass',0.07,r,0.09);if(n>1)cue('rewards','glass',0.055,r*semi(n>2?7:4),0.15);
  },
  // the store: coins on the counter, the till's latch, one bright note
  buy(){
    if(!cueNew('rewards')||!cueHave('coins-pouch','latch','ting'))return SFX_OLD.coin();
    cue('rewards','coins-pouch',0.48,1.08*cents(50));cue('rewards','latch',0.28,cents(60),0.2);cue('rewards','ting',0.28,TING_G6*semi(7)*cents(30),0.27);
  },
  // dawn: the nightly quota leaves the wallet. Coins poured out (lower, slower) and the ledger shut
  quota(){
    if(!cueNew('rewards')||!cueHave('coins-pouch','ui-close'))return;
    cue('rewards','coins-pouch',0.42,0.8*cents(40));cue('rewards','coins-pouch',0.3,0.7*cents(40),0.3);cue('rewards','ui-close',0.4,0.8,0.85);
  },
  // a new level: a bell under five climbing notes, the top one doubled so it rings on
  levelUp(){
    if(!cueNew('rewards')||!cueHave('ting','bell'))return SFX_OLD.gold();
    const d=cents(20);
    cue('rewards','bell',0.5,BELL_G4*d);
    [0,4,7,12,16].forEach((s,i)=>cue('rewards','ting',0.29+0.03*i,TING_G6*semi(s)*d,0.03+i*0.095));
    cue('rewards','ting',0.24,TING_G6*semi(19)*d,0.03+5*0.095);cue('rewards','ting',0.2,TING_G6*semi(12)*d,0.03+5*0.095);
  },
  /* ---- the pan and the sifter (89-goldfx.js) ---- */
  // called every 0.3 s while water runs over the pan's lip: every other call plays one of three water takes
  panSwirl(){
    if(!cueNew('rewards')||!cueHave('water-swirl-1','water-swirl-2','water-swirl-3'))return noise(.15,950,.6,.045,'bandpass');
    if(++swirlN%2)return;cue('rewards','water-swirl-'+(1+(swirlN>>1)%3),0.1+Math.random()*0.05,0.85+Math.random()*0.35);
  },
  panDunk(){if(!cueNew('rewards')||!cue('rewards','water-dunk',0.3,0.92+Math.random()*0.16))sfx.splash()},
  // called every 0.18 s while the sifter's tray shakes: a short gritty rub of sand, kept low and soft like the footsteps
  siftShake(){
    if(!cueNew('rewards')||!cueHave('step-sand-1','step-sand-2','step-sand-3'))return noise(.07,360,0.8,.026,'lowpass');
    siftN=siftN%3+1;cue('rewards','step-sand-'+siftN,0.14+Math.random()*0.06,1.6+Math.random()*0.5,0,2200);
  },
  /* ---- menus ---- */
  uiOpen(){if(cueNew('ui'))cue('ui','ui-open',0.3,cents(70))},
  uiClose(){if(cueNew('ui'))cue('ui','ui-close',0.09,0.92*cents(50))},
  uiHover(){if(cueNew('ui'))cue('ui','ui-hover',0.12,cents(40))},
  uiClick(){if(cueNew('ui'))cue('ui','ui-click',0.3,cents(40))},
  // "no": can't afford it, not allowed. Two dull wooden knocks, the second lower
  deny(){if(cueNew('ui')&&cue('ui','ui-deny',0.3,0.95)){cue('ui','ui-deny',0.26,0.76,0.11)}},
  /* ---- danger ---- */
  // you took damage. n: how much (a scratch is quieter than a rock to the head)
  hurt(n=10){
    if(!cueNew('danger')||!cueHave('hit-1','hit-2'))return sfx.thud();
    hitN=hitN%2+1;cue('danger','hit-'+hitN,clamp(0.26+n/75,0.26,0.6),0.95*cents(120));
  },
  // knocked out: the hit, then you go down in the dirt
  ko(){
    if(!cueNew('danger')||!cueHave('hit-2','bodyfall'))return;
    cue('danger','hit-2',0.45,0.72);cue('danger','bodyfall',0.55,0.9,0.16);cue('danger','bodyfall',0.28,0.7,0.34);
  },
  // a lizard has seen you: a dry rattling hiss that swells and trails off (the plain sfx.hiss is still the twister's and the fuse's)
  lizard(){
    if(!cueNew('danger')||!AC)return sfx.hiss();
    const v=0.1*cueVol('danger');if(v<=0)return;
    const t=AC.currentTime,s=AC.createBufferSource(),hp=AC.createBiquadFilter(),bp=AC.createBiquadFilter(),g=AC.createGain(),trem=AC.createGain(),lfo=AC.createOscillator(),depth=AC.createGain();
    s.buffer=noiseBuf;hp.type='highpass';hp.frequency.value=2400;bp.type='peaking';bp.frequency.setValueAtTime(6200,t);bp.frequency.exponentialRampToValueAtTime(3800,t+1.1);bp.Q.value=1.2;bp.gain.value=9;
    g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(v,t+0.09);g.gain.setValueAtTime(v,t+0.4);g.gain.exponentialRampToValueAtTime(0.0001,t+1.15);
    lfo.type='sawtooth';lfo.frequency.setValueAtTime(38,t);lfo.frequency.linearRampToValueAtTime(22,t+1.1);depth.gain.value=0.45;trem.gain.value=0.55;lfo.connect(depth).connect(trem.gain);   // the rattle
    s.connect(hp).connect(bp).connect(trem).connect(g).connect(fxBus);s.start(t,Math.random());s.stop(t+1.2);lfo.start(t);lfo.stop(t+1.2);
    s.onended=()=>{g.disconnect();lfo.disconnect()};
  },
  /* the curfew siren: a hand-cranked siren on a pole. Two slightly detuned saws wind up, sag, wind up again and run
     down, through a low-pass that opens with the pitch, with one echo so it sounds like it carries across the lake.
     Returns false in "old" mode so 82-patrol.js plays the original three sweeps. */
  siren(){
    if(!cueNew('danger')||!AC)return false;
    const v=0.09*cueVol('danger');if(v<=0)return true;
    const t=AC.currentTime,lp=AC.createBiquadFilter(),g=AC.createGain(),dl=AC.createDelay(1),fb=AC.createGain(),wet=AC.createBiquadFilter(),wg=AC.createGain();
    const pitch=[[0,150],[1.7,640],[2.6,600],[3.5,430],[4.6,660],[5.4,610],[7.4,110]];   // [seconds, Hz]
    const osc=[0,9,-1195].map((det,i)=>{const o=AC.createOscillator(),og=AC.createGain();o.type=i<2?'sawtooth':'triangle';o.detune.value=det;og.gain.value=i<2?0.5:0.35;
      o.frequency.setValueAtTime(pitch[0][1],t);for(const[s,f]of pitch.slice(1))o.frequency.linearRampToValueAtTime(f,t+s);o.connect(og).connect(lp);o.start(t);o.stop(t+7.6);return o});
    lp.type='lowpass';lp.Q.value=1.4;lp.frequency.setValueAtTime(500,t);for(const[s,f]of pitch.slice(1))lp.frequency.linearRampToValueAtTime(300+f*2.6,t+s);
    g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(v,t+1.2);g.gain.setValueAtTime(v,t+5.4);g.gain.exponentialRampToValueAtTime(0.0001,t+7.5);
    dl.delayTime.value=0.37;fb.gain.value=0.3;wet.type='lowpass';wet.frequency.value=1100;wg.gain.value=0.35;
    lp.connect(g).connect(fxBus);g.connect(dl);dl.connect(wet).connect(fb).connect(dl);wet.connect(wg).connect(fxBus);
    osc[0].onended=()=>setTimeout(()=>{g.disconnect();wg.disconnect();fb.disconnect()},2500);   // let the echo ring out
    return true;
  },
  /* the title screen's start press: the shovel bites, a low bell tolls, two faint high notes glint. Follows the Music
     volume (it is the game's only musical sting besides the disco). Clips are still downloading at that moment, so wait for them. */
  startSting(){
    if(!AC||!cueNew('ui'))return;
    Promise.all(['shovel','bell','ting'].map(loadAudioClip)).then(b=>{
      if(b.some(x=>!x)||!SETTINGS.volMusic)return;
      const bus=AC.createGain();bus.gain.value=SETTINGS.volMusic;bus.connect(master);setTimeout(()=>bus.disconnect(),6000);
      cue('ui','shovel',0.21,0.9,0,0,bus);cue('ui','bell',0.36,BELL_G4/2,0.02,0,bus);cue('ui','bell',0.13,BELL_G4*semi(7)/2,0.02,0,bus);
      cue('ui','ting',0.07,TING_G6,0.55,0,bus);cue('ui','ting',0.06,TING_G6*semi(7),0.75,0,bus);
    });
  }
});
/* ---- menu wiring: no call sites to keep in step. Buttons click and (with a mouse) tick on hover; a press on a
   greyed-out button knocks "no"; the big panels rustle open and thump shut when their `hidden` flips. ---- */
const UI_SND='button,[role="tab"],[role="button"],.shop-item,select,input[type="checkbox"]';
const uiSndEl=e=>{const el=e.target&&e.target.closest?e.target.closest(UI_SND):null;return el&&!el.closest('#touch')?el:null};   // not the on-screen gamepad
let uiHoverEl=null,uiHoverAt=0;
document.addEventListener('pointerover',e=>{
  const el=e.pointerType==='mouse'?uiSndEl(e):null;if(el===uiHoverEl)return;uiHoverEl=el;
  if(!el||el.disabled||!AC||performance.now()-uiHoverAt<70)return;uiHoverAt=performance.now();sfx.uiHover();
},true);
document.addEventListener('click',e=>{const el=uiSndEl(e);if(el&&!el.disabled&&AC)sfx.uiClick()},true);
document.addEventListener('pointerdown',e=>{const el=uiSndEl(e);if(el&&(el.disabled||el.getAttribute('aria-disabled')==='true')&&AC)sfx.deny()},true);
{const seen=new Map();
  const mo=new MutationObserver(list=>{for(const m of list){const el=m.target,was=seen.get(el);if(was===el.hidden)continue;seen.set(el,el.hidden);if(AC&&S.started)el.hidden?sfx.uiClose():sfx.uiOpen()}});
  for(const id of['pause','shop','inv','fieldMap','cards']){const el=document.getElementById(id);if(el){seen.set(el,el.hidden);mo.observe(el,{attributes:true,attributeFilter:['hidden']})}}}
