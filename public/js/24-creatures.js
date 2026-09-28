'use strict';
/* public/js/24-creatures.js -- the rigged Blender creatures: yellow-spotted lizard, javelina, mountain lion, vulture.
   Each is one skinned mesh (a Skin-modifier body with its face and markings joined on) with a small armature and
   looping clips, exported as models/Creature*.glb (sources: art/blender/beasts.py + rig.py on the art branch).
   Like the camp models, the old box creatures stay until a model has loaded, then get swapped: each creature file
   calls creatureUpgrade(...) with a callback, which runs immediately if the model is already in. */

const CREATURE_DEFS={
  lizard:{file:'CreatureLizard',prefix:'Lizard_',scale:1.25},
  javelina:{file:'CreatureJavelina',prefix:'Javelina_',scale:0.85},
  lion:{file:'CreatureLion',prefix:'Lion_',scale:1.1},
  vulture:{file:'CreatureVulture',prefix:'Vulture_',scale:1.6},
};
const CREATURES={};          // key -> {scene, clips} once loaded
const creatureWaiting={};    // key -> [callbacks]
function creatureUpgrade(key,cb){if(CREATURES[key])cb();else(creatureWaiting[key]=creatureWaiting[key]||[]).push(cb)}
for(const key in CREATURE_DEFS){
  const d=CREATURE_DEFS[key];
  new T.GLTFLoader().load(MODEL_DIR+d.file+'.glb',gl=>{
    gl.scene.traverse(o=>{if(!o.isMesh)return;
      srgbVertexColors(o.geometry);   // linear glTF colours -> the game's as-is colours (23-models.js)
      const m=o.material;o.material=new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:0.9,metalness:0,skinning:true,side:T.DoubleSide,color:m.color.clone().convertLinearToSRGB()});
      o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;   // bind-pose bounds don't cover the animated poses
    });
    // the exporter can bundle other creatures' same-boned clips: keep this creature's, drop the prefix
    const clips=gl.animations.filter(c=>c.name.startsWith(d.prefix)).map(c=>{c.name=c.name.slice(d.prefix.length);return c});
    CREATURES[key]={scene:gl.scene,clips};
    for(const cb of creatureWaiting[key]||[])cb();delete creatureWaiting[key];
  },undefined,e=>console.warn('creature model failed',key,e&&e.message));
}
/* a new animated copy: {obj, mixer, acts, cur} */
function spawnCreature(key){
  const C=CREATURES[key],obj=T.SkeletonUtils.clone(C.scene);obj.scale.setScalar(CREATURE_DEFS[key].scale);
  const mixer=new T.AnimationMixer(obj),acts={};for(const c of C.clips)acts[c.name]=mixer.clipAction(c);
  const r={obj,mixer,acts,cur:null};
  const first=acts.Idle||acts.Glide||Object.values(acts)[0];if(first){first.time=Math.random()*first.getClip().duration;first.play();r.cur=first===acts.Idle?'Idle':first===acts.Glide?'Glide':null}
  return r;
}
/* switch clip (cross-fade) and advance; speed scales the playback so steps match ground speed */
function creatureAnim(r,name,dt,speed){
  if(!r.acts[name])name=Object.keys(r.acts)[0];
  if(r.cur!==name){const a=r.acts[name];a.reset();a.fadeIn(0.2).play();if(r.cur&&r.acts[r.cur])r.acts[r.cur].fadeOut(0.2);r.cur=name}
  r.acts[name].timeScale=speed||1;r.mixer.update(dt);
}
