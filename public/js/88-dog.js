'use strict';
/* public/js/88-dog.js -- the mine-sniffing dog (JT 2026-10-01). Buy one at the Supply Depot (S.up.dog): it trots along
   at your heel, and when there's a landmine within DOG_SNIFF m of you it runs over, sits beside it and barks, and marks it
   for everyone ('mineMark': marked mines show clearly to all from MARK_SEE m, 88-mines.js). Friends' dogs follow them
   (pos flag dg) and point at marked mines near them. Model: art/blender (Sol) Dog.glb, rigged, clips Idle/Walk/Run/
   Sniff/Bark/Sit played with an AnimationMixer. */
const DOG_SNIFF=9,DOG={gltf:null,loading:false,dogs:new Map()};   // owner key ('me' or remote id) -> dog
function dogLoad(){if(DOG.loading)return;DOG.loading=true;new T.GLTFLoader().load('models/Dog.glb',g=>{const seen=new Set();g.scene.traverse(n=>{if(n.isMesh)for(const m of[].concat(n.material))if(m&&!seen.has(m)){seen.add(m);m.color&&m.color.convertLinearToSRGB()}});DOG.gltf=g},undefined,()=>{})}
function dogMake(key,p){
  const d={key,p,x:p.g.position.x-1,z:p.g.position.z-1,yaw:0,state:'follow',mine:-1,barkT:0,obj:null,mixer:null,acts:{},cur:null};DOG.dogs.set(key,d);return d}
function dogModel(d){
  if(d.obj||!DOG.gltf)return;const s=T.SkeletonUtils?T.SkeletonUtils.clone(DOG.gltf.scene):DOG.gltf.scene.clone(true);s.traverse(n=>{if(n.isMesh){n.castShadow=true;n.frustumCulled=false}});
  scene.add(s);d.obj=s;d.mixer=new T.AnimationMixer(s);for(const c of DOG.gltf.animations)d.acts[c.name]=d.mixer.clipAction(c)}
function dogClip(d,n){if(!d.mixer||d.cur===n)return;const a=d.acts[n]||d.acts.Idle;if(!a)return;a.reset().fadeIn(0.2).play();if(d.cur&&d.acts[d.cur])d.acts[d.cur].fadeOut(0.2);d.cur=n}
function dogBark(d){if(!nearCam(d.x,d.z,45))return;const v=clamp(1-Math.hypot(P.x-d.x,P.z-d.z)/45,0.1,1);tone(420,0.09,'square',0.06*v,260);setTimeout(()=>tone(380,0.1,'square',0.06*v,230),130)}
function dogStep(d,dt,mine){
  const o=d.p.g.position,fa=d.p===me?P.fa:d.p.g.rotation.y;let tx,tz,run=false;
  if(d.state==='point'){const m=MINES.get(d.mine);if(!m||(!mine&&!m.marked)){d.state='follow'}else{const a=Math.atan2(d.x-m.x,d.z-m.z);tx=m.x+Math.sin(a)*1.1;tz=m.z+Math.cos(a)*1.1;run=true}}
  if(d.state==='follow'){tx=o.x-Math.sin(fa)*1.6+Math.cos(fa)*0.8;tz=o.z-Math.cos(fa)*1.6-Math.sin(fa)*0.8;
    /* a mine near the owner: go and point at it (yours sniffs any; friends' only point at marked ones) */
    let best=null,bd=DOG_SNIFF;for(const m of MINES.values()){const dd=Math.hypot(o.x-m.x,o.z-m.z);if(dd<bd&&(mine||m.marked)){bd=dd;best=m}}
    if(best){d.state='point';d.mine=best.id;d.barked=false}}
  const dx=tx-d.x,dz=tz-d.z,dist=Math.hypot(dx,dz),far=Math.hypot(o.x-d.x,o.z-d.z);
  if(far>40){d.x=o.x-1;d.z=o.z-1}   // left behind (a teleport, a twister): catch up
  const sp=dist>0.3?Math.min(dist*3,run||dist>5?7:3.2):0;
  if(sp>0){d.x+=dx/dist*sp*dt;d.z+=dz/dist*sp*dt;d.yaw=Math.atan2(dx,dz)}
  if(d.state==='point'&&dist<0.4){const m=MINES.get(d.mine);if(m)d.yaw=Math.atan2(m.x-d.x,m.z-d.z);dogClip(d,'Sit');d.barkT-=dt;
    if(d.barkT<=0){d.barkT=1.1;dogClip(d,'Bark');dogBark(d);setTimeout(()=>{if(d.state==='point')dogClip(d,'Sit')},500)}
    if(mine&&m&&!m.marked&&!d.barked){d.barked=true;m.marked=true;if(online())wsSend({t:'mineMark',id:m.id});toast('Your dog found a landmine! It\'s marked for everyone.','gold',3000);logEv('dogMark',{id:m.id})}}
  else dogClip(d,sp>4?'Run':sp>0.2?'Walk':d.state==='point'?'Sniff':'Idle');
  if(d.obj){d.obj.position.set(d.x,groundAt(d.x,d.z),d.z);d.obj.rotation.y=d.yaw;d.obj.visible=!!d.p.g.visible&&!(d.p===me&&(inTent()||S.inTown))}
  if(d.mixer)d.mixer.update(dt);
}
function dogGone(key){const d=DOG.dogs.get(key);if(!d)return;if(d.obj)scene.remove(d.obj);DOG.dogs.delete(key)}
function updateDogs(dt){
  const want=new Map();if(S.started&&me&&S.up.dog)want.set('me',me);for(const[id,R]of remotes)if(R.dog)want.set(id,R.p);
  for(const k of[...DOG.dogs.keys()])if(!want.has(k))dogGone(k);
  if(!want.size)return;dogLoad();
  for(const[k,p]of want){const d=DOG.dogs.get(k)||dogMake(k,p);d.p=p;dogModel(d);dogStep(d,dt,k==='me')}
}
