'use strict';
/* public/js/48-paydirt.js -- PAY DIRT: where you dig decides how much gold is in your sand (2026-11-10).
   The rule itself is in sim.js (PAY, richAt, payMult, gradeOf): old creek channels wind across the lake bed, the sand
   on them is worth up to ~3.4x a plain hole, the sand away from them ~0.4x, and deeper sand is richer. This file is
   the camper's side of it:
   - sand remembers how rich it is. Your pan/bucket (S.bucketRich) and your hopper (S.hopperRich) each hold the
     average richness of what's in them; sandMix() folds new sand in by volume. The sifter, the pan, the hopper and
     the pipeline all multiply their gold by it.
   - prospecting. Nothing marks the paystreaks. You find them three ways:
       1. flecks: the odd fleck you spot while digging comes up far more often on good ground (fleckMult);
       2. the assay: every pan you wash or bucket you sift tells you its grade (Barren .. Rich);
       3. the map: each assay leaves a coloured dot where that sand was dug (S.samples, drawn by payMap on the
          minimap and the field map), so a few pans show you which way the streak runs.
   - the D Tent crew's buckets pay by where they dug too (crewPay).
   Loads after 46-holes.js; everything here is called at run time from 45-state.js, 86-hopper.js, 88-pipeline.js,
   30-npcs.js and 78-hud.js. Saved with the rest of S (60-title.js SAVE_KEYS). */
const PAY_SAMPLES=40;                                              // assay dots kept on your map
const PAY_COLORS=['#8a7a66','#b9a26a','#e0c04a','#ffb52e','#ff6a1f'];   // Barren, Trace, Promising, Pay dirt, Rich
const sandRich=k=>{const v=S[k+'Rich'];return v>0?v:1};
const sandReset=k=>{S[k+'Rich']=1};
/* `add` holes of sand worth `mult` go into S[k] (which already holds S[k] holes at sandRich(k)) */
function sandMix(k,add,mult){
  if(!(add>0))return;const have=Math.max(0,S[k]||0),m=mult>0?mult:1;
  S[k+'Rich']=have<1e-4?m:(have*sandRich(k)+add*m)/(have+add);
}
/* where the sand in your bucket is coming from: the volume-weighted middle of the holes you've dug into it */
const PAYDUG={x:0,z:0,w:0};
function payDug(h){const w=PAYDUG.w+1;PAYDUG.x+=(h.x-PAYDUG.x)/w;PAYDUG.z+=(h.z-PAYDUG.z)/w;PAYDUG.w=Math.min(w,40)}
/* flecks while you dig: rare on dead ground, common on a streak (x0.3 .. x5) */
const fleckMult=(x,z)=>SIM.PAY.on?0.3+4.7*SIM.richAt(x,z):1;
/* a batch has been washed, sifted or dumped: note its grade where it was dug, and return the line to show */
function payAssay(mult,quiet){
  if(!SIM.PAY.on)return'';
  const g=SIM.gradeOf(mult),name=SIM.PAY.grades[g];
  if(PAYDUG.w>0){
    if(!Array.isArray(S.samples))S.samples=[];
    const near=S.samples.findIndex(q=>Math.hypot(q[0]-PAYDUG.x,q[1]-PAYDUG.z)<6);   // one dot per spot: a new assay replaces the old
    if(near>=0)S.samples.splice(near,1);
    S.samples.push([Math.round(PAYDUG.x),Math.round(PAYDUG.z),g]);if(S.samples.length>PAY_SAMPLES)S.samples.shift();
    logEv('assay',{x:Math.round(PAYDUG.x),z:Math.round(PAYDUG.z),g,mult:+mult.toFixed(2)});PAYDUG.w=0;
  }
  const line=['Barren sand: try somewhere else.','Trace of colour.','Promising ground.','Pay dirt! Keep digging there.','RICH ground! Mark that spot.'][g];
  sfx.assay(g);   // Pay dirt / Rich get a rising sting (41-cues.js)
  if(quiet&&g>=3)toast(`${name}: ${line}`,'gold',3600);
  return`Assay: ${name}. ${g===0||g>=3?line:''}`.trim();
}
/* the dots on the minimap / field map */
function payMap(mx,wx,wz){
  if(!SIM.PAY.on||!Array.isArray(S.samples))return;
  for(const[x,z,g]of S.samples){mx.fillStyle=PAY_COLORS[g]||PAY_COLORS[0];mx.strokeStyle='#2b1d12';mx.lineWidth=1;mx.beginPath();mx.arc(wx(x),wz(z),g>=3?4:3,0,6.3);mx.fill();mx.stroke()}
}
/* a crew member's bucket: worth what the ground at his hole is worth (5 ft holes) */
function crewPay(b){try{const h=b.hole||b;return SIM.payMult(h.x,h.z,1.5)}catch(e){return 1}}
/* gold glints in the dirt you throw up on good ground: a few bright sparks (88-vein.js sparkle), brighter than white so
   the bloom makes them twinkle. Only on Promising ground or better, and not every scoop, so it rewards watching. */
function payGlint(h,y){
  if(!SIM.PAY.on)return;const r=SIM.richAt(h.x,h.z);if(r<0.45||Math.random()>r*0.55)return;
  const n=r>0.8?3:r>0.6?2:1;
  for(let i=0;i<n;i++){sparkle(h.x+(Math.random()-0.5)*1.1,y+0.1+Math.random()*0.5,h.z+(Math.random()-0.5)*1.1);const m=SPARKS[SPARKS.length-1].m;m.material.color.setRGB(2.6,2.0,0.7);m.scale.setScalar(0.6+Math.random()*0.5)}
  sfx.glint(n);
}
