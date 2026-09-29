'use strict';
/* public/js/83-roster.js -- the day's monster roster, ported from Greg's branch (claude/intense-change-1-test-2026-09-27-1829).
   The rules live in public/sim.js (stepRoster): the server runs them for everyone and sends 'rost' snapshots; solo play
   runs the same code here. This file draws the monsters, applies what they do to you, and adds the shovel swing and
   the `roster` console command.
     hatch    lizard hatchlings, in swarms          bite: a little poison          squash them with a shovel swing (E)
     snake    rattlesnakes, rattle before they strike: a lot of poison            squash / keep your distance
     scorp    scorpions come up where you're digging: poison                     squash
     sir      Mr. Sir walks the lake: stand around and he warns you, then takes your whole sack
     warden   the Warden: stand around and she knocks you out
     sheriff  near curfew, the Sheriff's ghost hunts whoever carries Kate Barlow's loot (lipstick, pistol, locket, strongbox)
     kate     at night, Kate Barlow's ghost only moves while nobody is looking at her
   An onion keeps the small ones off you. Poison is an affliction on your stamina bar (70-player.js). */
const RO_LOCAL={mobs:[]};                 // solo play's roster state (online, the server owns it)
const ROV=new Map();                      // id -> drawn monster {k, g, x,z,h, tx,tz,th, st, L, rig, p}
let RO_TODAY=[],roTodayKey='';
const RO_NAMES={hatch:'lizard hatchlings',snake:'rattlesnakes',scorp:'scorpions',sir:'Mr. Sir on patrol',sheriff:'the Sheriff\'s ghost',warden:'the Warden',kate:'Kate Barlow\'s ghost'};

/* ---- looks ---- */
function roSnakeMesh(){
  const g=new T.Group(),skin=M(0x8a6a3a),dark=M(0x4a3620);
  const pts=[];for(let i=0;i<=40;i++){const a=i/40*Math.PI*3.2,r=0.28-i/40*0.2;pts.push(new T.Vector3(Math.cos(a)*r,0.06+i/40*0.18,Math.sin(a)*r))}
  const body=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),60,0.045,6,false),skin);body.castShadow=true;g.add(body);
  const neck=new T.Group();neck.position.set(0,0.26,0);g.add(neck);g.userData.neck=neck;
  const n=cyl(0.04,0.045,0.35,6,0x8a6a3a);n.rotation.x=-1.1;n.position.set(0,0.1,0.12);neck.add(n);
  const head=box(0.11,0.06,0.15,0x7a5a30);head.position.set(0,0.2,0.3);neck.add(head);
  for(const s of[-1,1]){const e=box(0.02,0.02,0.02,0x111111);e.position.set(s*0.045,0.225,0.34);neck.add(e)}
  for(let i=0;i<4;i++){const b=box(0.05,0.03,0.04,i%2?0xc9b27a:0x3a2a18);b.position.set(Math.cos(Math.PI*3.2)*0.08,0.24+i*0.03,Math.sin(Math.PI*3.2)*0.08);g.add(b)}   // the rattle
  for(let i=0;i<6;i++){const d=box(0.06,0.012,0.06,0x4a3620);const a=i/6*Math.PI*3;d.position.set(Math.cos(a)*0.22,0.09+i*0.025,Math.sin(a)*0.22);g.add(d)}   // diamond marks
  return g;
}
function roScorpMesh(){
  const g=new T.Group(),c=0x3a2a1a;
  const body=box(0.16,0.06,0.26,c);body.position.y=0.06;g.add(body);
  for(const s of[-1,1]){
    for(let i=0;i<3;i++){const l=box(0.14,0.015,0.02,c);l.position.set(s*0.12,0.04,-0.06+i*0.07);l.rotation.z=s*0.4;g.add(l)}
    const arm=box(0.03,0.03,0.14,c);arm.position.set(s*0.1,0.07,0.18);arm.rotation.y=-s*0.4;g.add(arm);
    const claw=box(0.06,0.04,0.07,0x4a3422);claw.position.set(s*0.14,0.07,0.26);g.add(claw);
  }
  const tail=new T.Group();tail.position.set(0,0.08,-0.13);g.add(tail);g.userData.tail=tail;
  for(let i=0;i<5;i++){const t=box(0.05,0.05,0.07,c);const a=i*0.5;t.position.set(0,Math.sin(a)*0.06+i*0.04,-Math.cos(a)*0.05-i*0.03);t.rotation.x=a;tail.add(t)}
  const sting=new T.Mesh(new T.ConeGeometry(0.025,0.08,5),M(0xa83220));sting.position.set(0,0.26,0.02);sting.rotation.x=2.4;tail.add(sting);
  return g;
}
const RO_PEOPLE={
  sir:{look:{suit:0xb9a47a,shirt:0xb9a47a,skin:0xe0b08a,hat:'cowboy',shades:true,shovel:false,body:'stocky',band:0x3a2a1e},name:'Mr. Sir'},
  warden:{look:{suit:0x2c2c2c,shirt:0xd9d9d9,skin:0xe8c29c,hat:'cowboy',shovel:false,body:'tall',band:0x8a3a1c},name:'The Warden'},
  sheriff:{look:{suit:0x6f7f95,shirt:0x6f7f95,skin:0xb8c8d8,hat:'cowboy',shovel:false,body:'tall',band:0x2a3242},name:'The Sheriff\'s ghost',ghost:0x9fc4ff},
  kate:{look:{suit:0x7a5a6a,shirt:0x7a5a6a,skin:0xd8c0c8,hat:'cowboy',shovel:false,body:'slim',band:0x9a2030},name:'Kissin\' Kate Barlow',ghost:0xffb8c8},
};
function roGhostify(p,tint){
  p.g.traverse(o=>{if(!o.isMesh||!o.material||o.userData.ghost)return;o.userData.ghost=true;
    const m=o.material.clone();m.transparent=true;m.opacity=0.42;m.depthWrite=false;if(m.color)m.color.lerp(new T.Color(tint),0.55);if(m.emissive){m.emissive.setHex(tint);m.emissiveIntensity=0.35}o.material=m;o.castShadow=false});
}
function roMake(k){
  const v={k,x:0,z:0,h:0,tx:0,tz:0,th:0,st:0,seen:performance.now()};
  if(k==='snake')v.g=roSnakeMesh();
  else if(k==='scorp')v.g=roScorpMesh();
  else if(k==='hatch'){
    v.g=new T.Group();
    if(CREATURES.lizard){v.rig=spawnCreature('lizard');v.rig.obj.scale.multiplyScalar(0.35);v.g.add(v.rig.obj)}
    else{const b=box(0.12,0.06,0.3,0xd7bf43);b.position.y=0.04;v.g.add(b)}
  }else{
    const D=RO_PEOPLE[k];v.p=makePerson(D.look);v.g=v.p.g;v.L=makeLabel(v.g,D.name,'npc');v.ghost=D.ghost||0;
  }
  scene.add(v.g);return v;
}
function roDrop(id){const v=ROV.get(id);if(!v)return;scene.remove(v.g);if(v.L){v.L.el.remove();const i=labeled.indexOf(v.L);if(i>=0)labeled.splice(i,1)}ROV.delete(id)}

/* ---- snapshots (server 'rost', or solo) ---- */
function rosterSnapshot(list,today){
  const seen=new Set();
  if(Array.isArray(list))for(const e of list.slice(0,80)){
    if(!Array.isArray(e))continue;const id=e[0]|0,k=SIM.RO_KINDS[e[1]|0];if(!k)continue;seen.add(id);
    let v=ROV.get(id);const fresh=!v;if(!v){v=roMake(k);ROV.set(id,v)}
    v.tx=num(e[2],-600,600,0);v.tz=num(e[3],-600,600,0);v.th=num(e[4],-100,100,0);v.st=e[5]|0;
    if(fresh){v.x=v.tx;v.z=v.tz;v.h=v.th}
  }
  for(const id of [...ROV.keys()])if(!seen.has(id))roDrop(id);
  if(Array.isArray(today)){const key=today.join(',');if(key!==roTodayKey){const first=!roTodayKey;roTodayKey=key;RO_TODAY=today.filter(k=>RO_NAMES[k]);
    if(S.started&&RO_TODAY.length&&!first)toast('Out on the lake today: '+RO_TODAY.map(k=>RO_NAMES[k]).join(', ')+'.','',6000)}}
}

/* ---- what they do to you ---- */
function rosterEvent(e){
  if(!e||typeof e!=='object')return;
  const mine=e.id===myId(),dist=e.x!=null?Math.hypot(e.x-P.x,e.z-P.z):0;
  switch(e.k){
    case 'rbite':if(mine){hurt(5,'Lizard hatchling','Lizard hatchlings bit you. Swing your shovel (E) at them, or run.','poison');sfx.hiss()}break;
    case 'rattle':if(dist<22){noise(0.5,5200,6,0.2*clamp(1-dist/22,0.1,1));if(dist<8&&!roRattleTold){roRattleTold=true;toast('You hear a rattle nearby. Rattlesnake.','',2500)}}break;
    case 'strike':if(mine){hurt(20,'Rattlesnake','A rattlesnake got you. The poison eats your stamina until it wears off.','poison');sfx.bite()}break;
    case 'sting':if(mine){hurt(12,'Scorpion','Scorpion sting! Swing your shovel (E) at it.','poison');tone(1400,0.2,'square',0.06,600)}break;
    case 'squash':if(dist<25)sfx.thud();if(mine){addXP(3);countUp('squash',15,'squasher')}break;
    case 'sirWarn':if(mine){const sv=[...ROV.values()].find(v=>v.k==='sir');if(sv&&sv.L)say(sv.L,'You taking a nap out here?',3000);toast('Mr. Sir: "You taking a nap out here, camper?" Get digging, or he takes your sack.','bad',4500);tone(300,0.2,'square',0.05)}break;
    case 'confiscate':if(mine&&S.sack.length){toast(`Mr. Sir took your whole sack (${S.sack.length} finds) for slacking off.`,'bad',5000);logEv('confiscated',{n:S.sack.length});S.sack=[];sfx.clank()}break;
    case 'wardenWarn':if(mine){toast('The Warden is watching you stand around. Get digging, or keep moving!','bad',5000)}break;
    case 'down':if(mine&&!S.ko){const T2={warden:['The Warden','She caught you standing around out on the lake.'],sheriff:['The Sheriff\'s ghost','He came for Kate Barlow\'s loot, and you were holding it.'],kate:['Kissin\' Kate Barlow','You looked away.']}[e.by];if(T2)knockOut(T2[0],T2[1])}break;
    case 'sheriff':toast('Spurs jingle in the distance. The Sheriff\'s ghost is looking for whoever has Kate\'s loot.','bad',5000);break;
    case 'kate':toast('Kate Barlow\'s ghost is out on the lake. She only moves when nobody is looking at her.','bad',6000);break;
  }
}
let roRattleTold=false;

/* ---- the shovel: called from scoop() (45-state.js) before digging; true = the swing hit a critter instead ---- */
function rosterSwing(){
  const fx=Math.sin(P.fa),fz=Math.cos(P.fa);let near=false;
  for(const v of ROV.values()){if(v.k!=='hatch'&&v.k!=='snake'&&v.k!=='scorp')continue;const dx=v.x-P.x,dz=v.z-P.z,d=Math.hypot(dx,dz);if(d<2.4&&(dx*fx+dz*fz)/(d||1)>0.2){near=true;break}}
  if(!near)return false;
  if(online())wsSend({t:'rswat',x:+P.x.toFixed(2),z:+P.z.toFixed(2),fa:+P.fa.toFixed(2)});   // where you stand and face right now (the last 'pos' can be 100 ms old)
  else{const ev=[];SIM.rosterSwat(RO_LOCAL,{id:myId(),x:P.x,z:P.z,fa:P.fa},ev);rosterSnapshot(SIM.packRoster(RO_LOCAL));for(const e of ev)rosterEvent(e)}
  return true;
}
function kateLoot(){return S.sack.some(t=>t==='lipstick'||t==='pistol'||t==='locket')||(S.carry!=null&&typeof PROPS!=='undefined'&&PROPS.has(S.carry)&&PROPS.get(S.carry).type==='strongbox')}

/* ---- every frame ---- */
let roLocalT=0;
function updateRoster(dt){
  if(!online()&&S.started){
    const ev=[];SIM.stepRoster(RO_LOCAL,[meSim()],clockT(),dt,ev,{day:RUN.day||1,curse:RUN.curse||0,mood:RUN.mood,rate:tune('mon.roster')});
    if((roLocalT-=dt)<=0||ev.length){roLocalT=0.1;rosterSnapshot(SIM.packRoster(RO_LOCAL),RO_LOCAL.roster)}
    for(const e of ev)rosterEvent(e);
  }
  const k=Math.min(1,dt*10);
  for(const v of ROV.values()){
    const px=v.x,pz=v.z;v.x+=(v.tx-v.x)*k;v.z+=(v.tz-v.z)*k;
    let dh=v.th-v.h;dh=Math.atan2(Math.sin(dh),Math.cos(dh));v.h+=dh*Math.min(1,dt*8);
    const sp=Math.hypot(v.x-px,v.z-pz)/Math.max(dt,1e-3);
    v.g.position.set(v.x,groundAt(v.x,v.z),v.z);v.g.rotation.y=v.h;
    if(v.k==='snake'){const n=v.g.userData.neck;n.rotation.x=v.st===1?-0.6:Math.sin(performance.now()/300)*0.08;n.position.z=v.st===1?0.25:0}
    else if(v.k==='scorp'){v.g.userData.tail.rotation.x=Math.sin(performance.now()/180)*0.15}
    else if(v.k==='hatch'){if(v.rig)creatureAnim(v.rig,sp>0.3?'Walk':'Idle',dt,Math.max(0.6,sp/1.2));else if(CREATURES.lizard&&!v.rig){v.rig=spawnCreature('lizard');v.rig.obj.scale.multiplyScalar(0.35);v.g.clear();v.g.add(v.rig.obj)}}
    else if(v.p){
      animPerson(v.p,v.k==='kate'&&v.st===1?0:sp>3.5?4:sp>0.3?1:0,dt);
      if(v.ghost&&v.p.model&&!v.ghosted){v.ghosted=true;roGhostify(v.p,v.ghost)}
      if(v.k==='kate')v.g.visible=v.st===1||Math.sin(performance.now()/90)>-0.2;   // flickers while she moves
    }
  }
}

/* ---- console ---- */
command('roster',{usage:'roster [all|off|today|<kind>]',help:'Today\'s monsters. all: every kind. off: none. today: back to normal. A kind (hatch, snake, scorp, sir, sheriff, warden, kate) spawns one near you.',
  run([a]){
    a=(a||'').toLowerCase();
    if(!a)return'Today: '+((RO_TODAY.length?RO_TODAY:SIM.rosterFor(RUN.day||1)).map(k=>RO_NAMES[k]).join(', ')||'nothing')+`. Out now: ${ROV.size}.`;
    if(!['all','off','today',...SIM.RO_KINDS].includes(a))throw new Error('Usage: roster [all|off|today|hatch|snake|scorp|sir|sheriff|warden|kate]');
    if(online()){wsSend({t:'roster',op:a});return a==='all'?'Every kind of monster is on.':a==='off'?'Monsters off.':a==='today'?'Back to today\'s roster.':`Spawning ${RO_NAMES[a]} near you.`}
    const R=RO_LOCAL;
    if(a==='all'){R.all=true;R.off=[]}else if(a==='today'){R.all=false;R.force=[];R.off=[]}
    else if(a==='off'){R.all=false;R.force=[];R.off=SIM.RO_KINDS.slice();R.mobs=[]}
    else{R.off=(R.off||[]).filter(k=>k!==a);R.force=[...new Set([...(R.force||[]),a])];SIM.rosterSpawnNow(R,a,{x:P.x,z:P.z})}
    rosterSnapshot(SIM.packRoster(R),R.roster);
    return a==='all'?'Every kind of monster is on.':a==='off'?'Monsters off.':a==='today'?'Back to today\'s roster.':`Spawned ${RO_NAMES[a]} near you.`;
  }});
