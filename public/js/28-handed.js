'use strict';
/* public/js/28-handed.js -- LEFT- AND RIGHT-HANDED DIGGING (2026-11-11). The approved digging clips throw to one side
   each: the third-person Scoop and HandDig to the camper's left, the first-person ScoopFP and HandsFP to the right of
   your view. So that everyone agrees where the dirt goes, each of them also exists mirrored, and a digger throws to
   whichever side the heap is on (47-digfeel.js digPickSide).

   How a clip is mirrored (mirrorClip): it is played on a private copy of the rig at every frame (30 a second); each
   bone's pose in the model's own space is reflected left-right (S M S, S = scale(-1, 1, 1): a proper rotation, so
   nothing is turned inside out) and given to its counterpart bone (arm.L <-> arm.R, forearm, leg, shin; the middle
   bones keep their own), and the mirrored local pose is worked back out from the mirrored parent. The motion is the
   same motion, only its handedness changes. A rigid part riding one hand (the shovel on forearm.R) moves to the
   other hand's bone with its local placement reflected (S L), which is exactly where the mirror puts it; the
   first-person shovel rides its own middle bone and is just reflected in place. The two handed clips crossfade, and
   the shovel changes hands at the middle of the fade. */
const HAND_SWAP={armL:'armR',armR:'armL',forearmL:'forearmR',forearmR:'forearmL',legL:'legR',legR:'legL',shinL:'shinR',shinR:'shinL'};
const HAND_FPS=30;      // samples a second in a mirrored clip (the clips are authored at 30)
const HAND_FADE=0.22;   // s: crossfade between the two handed clips when a digger changes side
const _hS=new T.Matrix4().makeScale(-1,1,1);
/* a mirrored copy of clip, sampled on src (a private copy of the rig: its pose gets overwritten) */
function mirrorClip(src,clip,name){
  const mixer=new T.AnimationMixer(src),act=mixer.clipAction(clip);act.play();
  const bones=[];src.traverse(o=>{if(o.isBone)bones.push(o)});
  const byName=new Map(bones.map(b=>[b.name,b])),n=Math.max(2,Math.round(clip.duration*HAND_FPS)+1),times=new Float32Array(n);
  const pos=new Map(bones.map(b=>[b,new Float32Array(n*3)])),rot=new Map(bones.map(b=>[b,new Float32Array(n*4)]));
  const inv=new T.Matrix4(),ms=new Map(),v=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3(),a=new T.Matrix4(),b2=new T.Matrix4();
  const model=o=>ms.get(o)||ms.set(o,new T.Matrix4()).get(o);
  const mirrored=(o,out)=>{const c=o.isBone?byName.get(HAND_SWAP[o.name]||o.name)||o:o;return out.copy(_hS).multiply(model(c)).multiply(_hS)};
  for(let i=0;i<n;i++){
    const t=clip.duration*i/(n-1);times[i]=t;act.time=t;mixer.update(0);src.updateMatrixWorld(true);inv.copy(src.matrixWorld).invert();
    src.traverse(o=>model(o).multiplyMatrices(inv,o.matrixWorld));
    for(const bn of bones){
      mirrored(bn,a);mirrored(bn.parent,b2);b2.invert().multiply(a).decompose(v,q,s);   // local = parent'^-1 * bone'
      const P=pos.get(bn),R=rot.get(bn);P[i*3]=v.x;P[i*3+1]=v.y;P[i*3+2]=v.z;
      if(i&&q.x*R[i*4-4]+q.y*R[i*4-3]+q.z*R[i*4-2]+q.w*R[i*4-1]<0)q.set(-q.x,-q.y,-q.z,-q.w);   // keep each track on one side of the sphere
      R[i*4]=q.x;R[i*4+1]=q.y;R[i*4+2]=q.z;R[i*4+3]=q.w}
  }
  act.stop();mixer.uncacheRoot(src);
  const tracks=[];for(const bn of bones){tracks.push(new T.VectorKeyframeTrack(bn.name+'.position',times,pos.get(bn)),new T.QuaternionKeyframeTrack(bn.name+'.quaternion',times,rot.get(bn)))}
  return new T.AnimationClip(name,clip.duration,tracks);
}
/* the camper's clips: Scoop and HandDig get mirrored copies ScoopM and HandDigM (from 25-people.js once they load) */
function handedClips(){
  const want=['Scoop','HandDig'],src=T.SkeletonUtils?T.SkeletonUtils.clone(MODEL.scene):null;if(!src)return;
  for(const nm of want){const c=MODEL.clips.find(c=>c.name===nm);if(c&&!MODEL.clips.some(x=>x.name===nm+'M'))MODEL.clips.push(mirrorClip(src,c,nm+'M'))}
}
/* the shovel in the hand that's doing the shovel's job: forearm.R normally, forearm.L (reflected) in a mirrored clip */
function handedShovel(p,left){
  if(!p.shovelMeshes||!p.model)return;
  if(!p.shovelHome){p.shovelHome=[];const fl=p.model.getObjectByName('forearmL');
    for(const n of p.shovelMeshes){n.updateMatrix();p.shovelHome.push({n,par:n.parent,m:n.matrix.clone(),mm:_hS.clone().multiply(n.matrix),alt:fl})}}
  for(const h of p.shovelHome){if(!h.alt)continue;h.n.matrixAutoUpdate=false;
    if(left){if(h.n.parent!==h.alt)h.alt.add(h.n);h.n.matrix.copy(h.mm)}else{if(h.n.parent!==h.par)h.par.add(h.n);h.n.matrix.copy(h.m)}}
  p.shovelLeft=left;
}
/* every frame for a digging person (25-people.js animModel): the shovel goes to the other hand once the mirrored clip
   is more than half faded in, and back once it's faded out */
function handedPose(p){
  const m=!!(p.cur&&/M$/.test(p.cur)&&p.cur!=='HandDigM'),a=p.acts[p.cur];
  if(m!==!!p.shovelLeft&&(!a||a.getEffectiveWeight()>0.5))handedShovel(p,m);
}
/* the first-person arms (71-fp-scoop.js): their own mirrored copies, and the same crossfade */
function handedFP(){
  if(!FPS.g||FPS.mir)return;FPS.mir={};const src=T.SkeletonUtils.clone(FPS.g);
  for(const[k,a]of[['act',FPS.act],['hands',FPS.hands]]){if(!a)continue;const c=mirrorClip(src,a.getClip(),a.getClip().name+'M'),m=FPS.mixer.clipAction(c);m.timeScale=0;FPS.mir[k]=m}
  FPS.shovelHome=FPS.shovel.map(n=>{n.updateMatrix();return{n,m:n.matrix.clone(),mm:_hS.clone().multiply(n.matrix)}});
}
