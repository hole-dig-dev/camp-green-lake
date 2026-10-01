'use strict';
/* public/js/84-rigid.js -- loot you grab has a real shape: a box the size of its model that turns, tips and tumbles.
   JT (2026-09-29): track the full object, the space and shape it takes up. Our own physics, not an engine (we can move
   to one later): the box is 8 corner points held rigidly together (the same trick as the ragdoll in 26-ragdoll.js), and
   each corner meets the ground on its own, so a crate lands on its side, the jug tips over, and a safe dragged over a
   hole's edge tilts in. A hand holds the spot on the box it first took hold of (the point nearest the hand), so
   something grabbed by a corner swings from it, R.E.P.O.-style; two people on it hold two spots.
   The wheelbarrow and downed campers keep the simpler point physics (stepThing in 84-grab.js).
   Networking: the owner sends the orientation with 'pst' (q, a quaternion) and everyone else turns it smoothly. */
const RIG_ITER=4;                        // constraint passes per 1/60 s step: keeps the box a box
const RIG_MU=0.55;                       // a corner on the ground loses this much of its sliding per step
const RIG_BOUNCE=0.15;                   // how much of a corner's landing speed bounces back up
const RIG_SPIN_HELD=0.06,RIG_SPIN_FREE=0.004;   // per step: how fast spin dies away, held / loose
const RIG_TOSS_SPIN=3.5;                 // rad/s of random tumble a throw adds
const RIG_DAMP=0.05;                     // hand damping, as a share of the grip's stiffness (F2 > Grab > grab.stiff)
const RG_A=new T.Vector3(),RG_B=new T.Vector3(),RG_C=new T.Vector3(),RG_M=new T.Matrix4(),RG_Q=new T.Quaternion();

const isRigid=t=>!!t&&!t.isBody&&!t.body&&t.type!=='cart'&&!!SIM.PHYS[t.type];
const rgSign=(i,a)=>(i>>a)&1?1:-1;       // corner i: x = bit 0, y = bit 1, z = bit 2
/* the box around the model, in its own frame: half-sizes and the centre's offset from the model's origin */
function rigBox(pr){
  if(pr.rb)return pr.rb;
  const g=pr.g,q0=g.quaternion.clone(),p0=g.position.clone();g.quaternion.identity();g.position.set(0,0,0);g.updateMatrixWorld(true);
  const bb=new T.Box3().setFromObject(g),c=bb.getCenter(new T.Vector3()),s=bb.getSize(new T.Vector3());
  g.quaternion.copy(q0);g.position.copy(p0);
  return pr.rb={hx:Math.max(0.08,s.x/2),hy:Math.max(0.08,s.y/2),hz:Math.max(0.08,s.z/2),c};
}
/* (re)build the 8 corners from where the thing is and which way it's turned (after a teleport, a spill, or taking over) */
function rigBuild(pr){
  const B=rigBox(pr),q=pr.q||(pr.q=new T.Quaternion()),com=new T.Vector3(pr.x,pr.y+B.hy,pr.z),pts=[],dt=1/60;
  for(let i=0;i<8;i++){
    RG_A.set(rgSign(i,0)*B.hx,rgSign(i,1)*B.hy,rgSign(i,2)*B.hz).applyQuaternion(q).add(com);
    pts.push({x:RG_A.x,y:RG_A.y,z:RG_A.z,px:RG_A.x-(pr.vx||0)*dt,py:RG_A.y-(pr.vy||0)*dt,pz:RG_A.z-(pr.vz||0)*dt});
  }
  const L=[];for(let i=0;i<8;i++)for(let j=i+1;j<8;j++)L.push([i,j,Math.hypot(pts[i].x-pts[j].x,pts[i].y-pts[j].y,pts[i].z-pts[j].z)]);
  pr.rp={pts,L,com:com.clone()};pr.anch=new Map();
  return pr.rp;
}
/* orientation and centre from the corners (Gram-Schmidt on the averaged edges) */
function rigFrame(pr){
  const P8=pr.rp.pts,ex=RG_A.set(0,0,0),ey=RG_B.set(0,0,0),com=pr.rp.com.set(0,0,0);
  for(let i=0;i<8;i++){const p=P8[i];com.x+=p.x/8;com.y+=p.y/8;com.z+=p.z/8;
    if(i&1){const o=P8[i^1];ex.x+=p.x-o.x;ex.y+=p.y-o.y;ex.z+=p.z-o.z}
    if(i&2){const o=P8[i^2];ey.x+=p.x-o.x;ey.y+=p.y-o.y;ey.z+=p.z-o.z}}
  ex.normalize();ey.addScaledVector(ex,-ey.dot(ex)).normalize();const ez=RG_C.crossVectors(ex,ey);
  pr.q.setFromRotationMatrix(RG_M.makeBasis(ex,ey,ez));
  return com;
}
/* a hand's hold: trilinear weights over the corners for the point on the box nearest the hand, fixed from then on */
function rigAnchor(pr,key,h){
  let w=pr.anch.get(key);if(w)return w;
  const B=pr.rb,com=pr.rp.com,iq=RG_Q.copy(pr.q).invert();
  RG_A.set(h[0]-com.x,h[1]-com.y,h[2]-com.z).applyQuaternion(iq);
  const u=(clamp(RG_A.x/B.hx,-1,1)+1)/2,v=(clamp(RG_A.y/B.hy,-1,1)+1)/2,s=(clamp(RG_A.z/B.hz,-1,1)+1)/2;
  w=[];for(let i=0;i<8;i++)w.push((i&1?u:1-u)*(i&2?v:1-v)*(i&4?s:1-s));
  pr.anch.set(key,w);return w;
}
function rigPoint(P8,w,dt,pos,vel){
  pos.set(0,0,0);vel.set(0,0,0);
  for(let i=0;i<8;i++){const p=P8[i],k=w[i];if(!k)continue;pos.x+=p.x*k;pos.y+=p.y*k;pos.z+=p.z*k;vel.x+=(p.x-p.px)/dt*k;vel.y+=(p.y-p.py)/dt*k;vel.z+=(p.z-p.pz)/dt*k}
}
const RG_P=new T.Vector3(),RG_V=new T.Vector3();

/* ---- one physics step, run by whoever owns the thing (84-grab.js updateGrab picks this for loot) ---- */
function stepRigid(t,dt){
  rigBox(t);
  if(!t.rp||!t.rOwn||Math.hypot(t.rp.com.x-t.x,t.rp.com.y-(t.y+t.rb.hy),t.rp.com.z-t.z)>0.3)rigBuild(t);   // moved by someone else, or just taken over
  t.rOwn=true;
  const R=t.rp,P8=R.pts,m=massOf(t),mi=m/8,K=tune('grab.stiff'),D=K*RIG_DAMP,FM=tuneGrab('fmax'),now=performance.now();
  const F=R.F||(R.F=Array.from({length:8},()=>new T.Vector3()));for(const f of F)f.set(0,-9.82*mi,0);
  let held=0,ropeUp=0,ropeCap=0,handCap=0,lift=0;
  for(const k of [...t.anch.keys()])if(!t.hands.has(k))t.anch.delete(k);   // let go: forget where they held it
  for(const[key,H]of t.hands){
    const self=key===myId()||key==='r'+myId();
    if(!self&&now-H.t>600){t.hands.delete(key);continue}
    const w=rigAnchor(t,key,H.h);rigPoint(P8,w,dt,RG_P,RG_V);
    const dx=H.h[0]-RG_P.x,dy=H.h[1]-RG_P.y,dz=H.h[2]-RG_P.z,dl=Math.hypot(dx,dy,dz)||1e-3;
    let gx,gy,gz;
    if(H.rope){
      if(dl>SIM.ROPE.MAX*1.15){t.hands.delete(key);ropeGone(t,key);continue}
      if(dl<=SIM.ROPE.L)continue;   // slack
      const f=Math.min(FM,SIM.ROPE.K*(dl-SIM.ROPE.L)),vr=(RG_V.x*dx+RG_V.y*dy+RG_V.z*dz)/dl,fd=f-Math.max(0,vr)*D*0.3;
      gx=dx/dl*fd;gy=dy/dl*fd;gz=dz/dl*fd;ropeCap+=FM;ropeUp+=dy/dl;
    }else{
      if(dl>SIM.GRAB.SNAP){t.hands.delete(key);if(self){releaseGrab(false);toast('It slipped out of your hands. Too far, or too heavy.','bad',2500)}continue}
      gx=dx*K-RG_V.x*D;gy=dy*K-RG_V.y*D;gz=dz*K-RG_V.z*D;const gm=Math.hypot(gx,gy,gz);if(gm>FM){gx*=FM/gm;gy*=FM/gm;gz*=FM/gm}
      handCap+=FM;
    }
    held++;lift+=gy;
    for(let i=0;i<8;i++){const k=w[i];if(k){F[i].x+=gx*k;F[i].y+=gy*k;F[i].z+=gz*k}}
  }
  // THE ROPE SLIPS: hauling something heavy up out of a hole with too few people on it (same rule as stepThing)
  if(ropeCap&&ropeUp>0.5){const inHole=baseH(t.x,t.z)-t.y>0.9;
    if(inHole&&ropeCap+handCap<m*9.82*1.15&&Math.random()<dt*0.45){for(const k of [...t.hands.keys()])if(t.hands.get(k).rope)t.hands.delete(k);for(const p of P8)p.py=p.y+1.5*dt;ropeSlip(t);return}}
  // move: Verlet, with a little air drag; spin dies away (faster while held, so a carried thing settles in your hands)
  const lin=1-(held?0.35:0.05)*dt,spin=held?RIG_SPIN_HELD:RIG_SPIN_FREE,dt2=dt*dt;
  let vcx=0,vcy=0,vcz=0;for(const p of P8){vcx+=(p.x-p.px)/8;vcy+=(p.y-p.py)/8;vcz+=(p.z-p.pz)/8}
  for(let i=0;i<8;i++){const p=P8[i],f=F[i];
    const vx=(vcx+((p.x-p.px)-vcx)*(1-spin))*lin,vy=(vcy+((p.y-p.py)-vcy)*(1-spin))*lin,vz=(vcz+((p.z-p.pz)-vcz)*(1-spin))*lin;
    p.px=p.x;p.py=p.y;p.pz=p.z;p.x+=vx+f.x/mi*dt2;p.y+=vy+f.y/mi*dt2;p.z+=vz+f.z/mi*dt2;
  }
  // keep it a box, then the ground and walls under every corner
  let imp=0;
  for(let it=0;it<RIG_ITER;it++){
    for(const[a,b,len]of R.L){const A=P8[a],Bp=P8[b],dx=Bp.x-A.x,dy=Bp.y-A.y,dz=Bp.z-A.z,d=Math.hypot(dx,dy,dz)||1e-4,k=(d-len)/d*0.5;
      A.x+=dx*k;A.y+=dy*k;A.z+=dz*k;Bp.x-=dx*k;Bp.y-=dy*k;Bp.z-=dz*k}
    for(const p of P8){
      p.x=clamp(p.x,-EDGE+1,EDGE-1);p.z=clamp(p.z,-EDGE+1,EDGE-1);
      for(const c of colliders)if(p.x>c.x0&&p.x<c.x1&&p.z>c.z0&&p.z<c.z1){const px=Math.min(p.x-c.x0,c.x1-p.x),pz=Math.min(p.z-c.z0,c.z1-p.z);
        if(px<pz)p.x=p.x<(c.x0+c.x1)/2?c.x0:c.x1;else p.z=p.z<(c.z0+c.z1)/2?c.z0:c.z1}
      const gy=groundAt(p.x,p.z);
      if(p.y<gy){
        const vIn=(p.py-p.y)/dt;if(it===0)imp=Math.max(imp,vIn);
        p.y=gy;p.px+=(p.x-p.px)*RIG_MU;p.pz+=(p.z-p.pz)*RIG_MU;   // friction
        p.py=vIn>1.2?gy-vIn*RIG_BOUNCE*dt:gy;                         // a hard landing bounces a little
      }
    }
  }
  // chips: the hardest corner landing this step
  if(t.v0&&imp>SIM.DMG.MIN&&now-t.hitT>SIM.DMG.COOL*1000&&t.val>0){
    t.hitT=now;const loss=Math.min(t.val,Math.max(1,Math.round(t.v0*t.ph.frag*(imp-SIM.DMG.MIN)*SIM.DMG.RATE*tune('grab.fragile'))));
    t.val-=loss;propHit(t,loss);
  }
  // where it is now, as the rest of the game sees it: x/z the centre, y the centre less half its height, and q
  const com=rigFrame(t);let vx=0,vy=0,vz=0,vmax=0;
  for(const p of P8){const a=(p.x-p.px)/dt,b=(p.y-p.py)/dt,c=(p.z-p.pz)/dt;vx+=a/8;vy+=b/8;vz+=c/8;vmax=Math.max(vmax,Math.hypot(a,b,c))}
  t.x=com.x;t.y=com.y-t.rb.hy;t.z=com.z;t.vx=vx;t.vy=vy;t.vz=vz;
  t.restT=(vmax>0.1||held)?0:t.restT+dt;
  const wasRest=t.rest;t.rest=!held&&t.restT>0.6;
  if(online()&&((t.rest&&!wasRest)||(!t.rest&&now-(t.sentT||0)>100))){t.sentT=now;const q=t.q;   // the settling update always goes out: nothing more is sent after it
    wsSend({t:'pst',id:t.id,x:+t.x.toFixed(2),y:+t.y.toFixed(2),z:+t.z.toFixed(2),vx:+t.vx.toFixed(2),vy:+t.vy.toFixed(2),vz:+t.vz.toFixed(2),val:t.val,rest:t.rest,q:[+q.x.toFixed(3),+q.y.toFixed(3),+q.z.toFixed(3),+q.w.toFixed(3)]})}
  if(!online()&&Math.hypot(t.x-SIM.SELL.x,t.z-SIM.SELL.z)<SIM.SELL.r){const v=t.val;propSold(t.id,v,[myId()])}
}
/* a throw: the whole box gets the throw's speed, plus a random tumble */
function rigidKick(t,dvx,dvy,dvz){
  if(!t.rp)rigBuild(t);const P8=t.rp.pts,dt=1/60,com=t.rp.com;
  const wx=(Math.random()-0.5)*2*RIG_TOSS_SPIN,wy=(Math.random()-0.5)*2*RIG_TOSS_SPIN,wz=(Math.random()-0.5)*2*RIG_TOSS_SPIN;
  for(const p of P8){const rx=p.x-com.x,ry=p.y-com.y,rz=p.z-com.z;   // v += dv + w x r
    p.px-=(dvx+wy*rz-wz*ry)*dt;p.py-=(dvy+wz*rx-wx*rz)*dt;p.pz-=(dvz+wx*ry-wy*rx)*dt}
}
/* drawing it: the owner shows its own corners; everyone else eases towards the last position and turn it heard */
function rigidDraw(pr,tx,ty,tz,k){
  const B=rigBox(pr),q=pr.q||(pr.q=new T.Quaternion()),g=pr.g;
  if(iOwn(pr)&&pr.rp)g.quaternion.copy(q);else g.quaternion.slerp(pr.qNet||q,k);
  RG_A.set(tx,ty+B.hy,tz);const c=RG_B.copy(B.c).applyQuaternion(g.quaternion);   // the model's origin: the centre less its (turned) offset
  const ox=RG_A.x-c.x,oy=RG_A.y-c.y,oz=RG_A.z-c.z;
  g.position.x+=(ox-g.position.x)*k;g.position.y+=(oy-g.position.y)*k;g.position.z+=(oz-g.position.z)*k;
}
