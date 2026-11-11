'use strict';
/* public/js/89-town-story.js -- what's in Marlow's Landing (2026-11-11). Every building has a reason to go in:
   - one find in a fixed place (sim.js TOWN_SIGS): worth real gold, or a small use for the rest of the run (the Marshal's
     lantern widens your flashlight, the barber's strop sharpens your blade, the doctor's Restorative, the cellar's pickled
     bitterroot), and the bank manager's key. Taking it is the crew's ('tsig'), and it ticks the building off the
     checklist (89-town-map.js): search all sixteen for a reward;
   - one scrap of the story (a note, a ledger page, a poster, scratches on a wall) that F reads to you. Together they tell
     what happened to the town (the Water Company's dam, June Pruitt's wedding, Lil's ring) and where Lil's strongbox
     really went;
   - Lil's vault at the east end: its door needs the bank manager's key, both halves of the dial (one note in the
     saloon, one in Lil's house) and the counterweight in the root cellar. Each step is the crew's ('tvault'). Open, it
     holds six gold bars: 45 kg each, a slow walk in your arms, carried up the break-in shaft or the stairwell to come out
     on the lake as heavy loot (sim.js HEAVY.ingot) to haul to the Company Store. The server remembers every step. */
const STORY_REACH=2.3;   // m: how close you stand to read, take or use something
const H_LIL=()=>compass(SEARCH.x-SIM.OLD_TOWN.x,SEARCH.z-SIM.OLD_TOWN.z);   // which way from the old town's steeple Lil rowed
// key: [find: name, val (sack, sells) or use, its spot [dx,dz,h] in the building (front door is local -z)], [the scrap: title, text, spot, its own paper?]
const TOWN_STORY={
  saloon:{find:{id:'deck',name:'Lil\'s marked deck',val:45,at:[4.08,-3.57,0.8]},
    note:{title:'An IOU, behind the bar',at:[-2.3,4.25,1.14],paper:1,text:()=>'"I.O.U. one wedding ring, gold, to Miss L. Marlow. Lost on a pair of nines. Amos Tate." On the back, in a neater hand: "Vault, first half: 18. Everyone in here knows it already. L."'}},
  church:{find:{id:'plate',name:'Silver collection plate',val:70,at:[0,5.05,0.27]},
    note:{title:'A wedding programme, on the pulpit',at:[-2.6,4.75,1.27],paper:1,text:()=>'"The marriage of Miss June Pruitt and Mr. Amos Tate. Two o\'clock, reception to follow, weather permitting." Pencilled in the margin: "Water at the second pew. Keep singing."'}},
  hotel:{find:{id:'watch',name:'Gold pocket watch, stopped at ten past two',val:80,at:[4.08,-3.57,0.52]},
    note:{title:'The hotel register',at:[-3.58,-2.58,1.1],paper:1,text:()=>'Room 7: Miss L. Marlow, "indefinitely." Room 8: a Water Company surveyor, "until the dam is done." Room 9: the surveyor\'s dog, paid in advance.'}},
  store:{find:{id:'coffee',name:'Tin of coffee, 1886, never opened',val:35,at:[-5.9,2.68,1.1]},
    note:{title:'A notice on the counter',at:[-2.3,2.68,1.1],paper:1,text:()=>'"CLOSING DOWN. Everything must go: buckets, sandbags, rowing boats. The Marlow\'s Landing Water Company regrets any inconvenience." Somebody has crossed out "Water" and written "Drywater Reclamation" above it, recently.'}},
  bank:{find:{id:'vaultkey',name:'The bank manager\'s key',use:'vaultkey',at:[4.48,-3.57,0.8]},
    note:{title:'A page of the bank ledger',at:[3.68,-3.57,0.8],paper:1,text:()=>'"Deposit, Miss L. Marlow: one town, won at cards. Withdrawal, Miss L. Marlow: everything else." Manager\'s note: "The key to her vault is in my desk, where she would never think to look."'}},
  stable:{find:{id:'bridle',name:'Silver-mounted bridle',val:65,at:[-4.08,-3.57,1.15]},
    note:{title:'A bill nailed to the trough',at:[4.08,-4.18,0.53],paper:1,text:()=>'"Owing: Miss L. Marlow, hay for one horse, name of Dividend." Underneath: "Horse left town the week before the water did. Smartest one here."'}},
  school:{find:{id:'medal',name:'Spelling-bee medal, gold-plated',val:40,at:[4.48,-3.57,0.8]},
    note:{title:'The blackboard',at:[-3.78,5.75,1.9],text:()=>'A hundred lines in chalk: I WILL NOT BET MY LUNCH WITH LIL MARLOW. At the bottom, very small: "or my boots."'}},
  marshal:{find:{id:'mlantern',name:'The Marshal\'s bullseye lantern',use:'mlantern',at:[3.83,-2.78,0.8]},
    note:{title:'A WANTED poster',at:[-3.93,4.8,1.75],text:()=>'"WANTED: \'Lucky\' Lil Marlow, for cheating at cards, robbing the bank, and winning. REWARD $500, or whatever she hasn\'t won off us by Friday."'}},
  jail:{find:{id:'jailspoon',name:'A spoon, worn down by digging',val:30,at:[-4.75,3.75,0.52]},
    note:{title:'Scratched into the cell wall',at:[-3.3,4.8,1.4],text:()=>'"Day 1. Marshal says a night inside will cool me off. Day 3. Water under the door. Marshal has the key and is on the roof. Day 4. I am cooled off."'}},
  post:{find:{id:'parcel',name:'Registered parcel of gold coins',val:95,at:[-4.7,2.08,1.1]},
    note:{title:'An undelivered letter',at:[-1.9,2.08,1.1],paper:1,text:()=>'"Dear Mother, the Company says the new lake will be good for business. Nobody here has a boat except Lil, and she is charging a dollar a head. Your loving son." Stamped: POSTAGE DUE.'}},
  boatshed:{find:{id:'spyglass',name:'Lil\'s brass spyglass',val:60,at:[-3.9,-4.35,0.87]},
    note:{title:'The ROYAL FLUSH\'s logbook',at:[-2.8,-4.35,0.87],paper:1,text:()=>`"Thursday night. Out alone with one heavy box. Rowed ${H_LIL()} of the church steeple until I couldn't see the lights. Friday, back, no box. Did not count the strokes out loud."`}},
  doctor:{find:{id:'tonic3',name:'Dr. Pell\'s Restorative, three bottles',use:'tonic3',at:[-3.33,3.08,0.98]},
    note:{title:'Dr. Pell\'s casebook',at:[2.93,-3.08,0.8],paper:1,text:()=>'"Patient: the Marshal. Complaint: lost a bet with Miss Marlow. Treatment: Restorative twice daily, and stop betting with Miss Marlow." Added later: "Patient did not comply."'}},
  barber:{find:{id:'razor',name:'The barber\'s razor and strop',use:'razor',at:[3.8,3.55,0.92]},
    note:{title:'The price board',at:[-2.0,3.55,0.92],paper:1,text:()=>'"SHAVE 10c. HAIRCUT 15c. HOT BATH 25c, BRING YOUR OWN WATER." Chalked underneath: "Baths free until further notice. The whole town is one."'}},
  lil:{find:{id:'dollar',name:'Lil\'s lucky silver dollar',val:100,at:[2.43,3.45,1.02]},
    note:{title:'Lil\'s diary, open on the bed',at:[-2.83,2.0,0.62],paper:1,text:()=>'"June cried all through supper about her ring. I told her she\'d get it back when the lake dries up, which got a laugh. The vault\'s second half is 87, like the year. The first half is in the saloon, where everybody loses their head."'}},
  cellar:{find:{id:'pickles',name:'A crock of pickled bitterroot',use:'pickles',at:[-1.1,1.6,0]},
    note:{title:'A plate on the lever',at:[4.2,-1.15,1.75],text:()=>'"COUNTERWEIGHT. Pull to unseal Miss Marlow\'s vault. Do not pull while standing in Miss Marlow\'s vault." A chain runs from it up into the ceiling and away north-east.'}},
  well:{find:{id:'pennies',name:'A handful of wishing-well pennies',val:25,at:[1.6,-0.6,0]},
    note:{title:'Carved on the well board',at:[0,-1.35,0.62],text:()=>'"MAKE A WISH, 1c." Scratched into the wood beside it: "Wished the lake would go away. J.P." It took a while.'}},
  vault:{note:{title:'A letter on Lil\'s desk',at:[-2.83,1.98,0.8],paper:1,text:()=>'"If you\'re reading this, the lake dried up and you got past my door. Keep the bars, I have plenty. The box with June\'s ring went over the side of the Royal Flush, and it is the only thing I ever lost. L.M."'},
    chart:{title:'Lil\'s chart of the lake, on the wall',at:[-2.53,3.8,1.6],text:()=>{const[X,Y]=coordXY(SEARCH.x,SEARCH.z);return`A chart of the lake before it was a lake, the church steeple inked in. ${H_LIL()[0].toUpperCase()+H_LIL().slice(1)} of it, a red X and "about here." In today's numbers that's roughly X ${X}, Y ${Y}. Deeper than five feet, knowing Lil.`}}},
};
// the finds that go in the sack are loot like any other (sold at the Company Store); the rest are used on the spot
for(const k in TOWN_STORY){const f=TOWN_STORY[k].find;if(f&&f.val)LOOT[f.id]={name:f.name,val:f.val,color:0xd4af37}}
LOOT.ingot={name:'Lil\'s gold bar',val:SIM.HEAVY.ingot,color:0xd4af37,heavy:true};
BADGES.historian=['Town historian','Search every building in Marlow\'s Landing'];BADGES.safecracker=['Safecracker','Be there when Lil\'s vault opens'];
if(!Array.isArray(S.townRead))S.townRead=[];
const TOWN_USE={
  vaultkey:()=>{S.up.vaultkey=true;return'A heavy brass key with a paper tag: "MARLOW. Vault." The vault is at the east end of Main Street.'},
  mlantern:()=>{S.up.mlantern=true;return'You fit the Marshal\'s brass reflector over your flashlight. The beam is wider from now on.'},
  razor:()=>{S.up.razor=true;return'Ten strokes on the strop and your blade has an edge it never had. You dig faster from now on.'},
  tonic3:()=>{S.tonic=(S.tonic||0)+3;return'Three bottles of Restorative. Mostly alcohol, some regret. (+3 tonics)'},
  pickles:()=>{S.bitterroots+=3;return'Pickled bitterroot, still sealed. Gilas hate it even more this way. (+3 bitterroots)'},
};
const TS={notes:[],finds:new Map(),bars:[],door:null,doorA:0,doorOpenT:-1,lever:null,leverA:0,vaultLight:null,glint:null,vb:null,doorPos:null};
function bLocal(b,dx,dz){const[x,z]=rotLocal(dx,dz,b.ry);return{x:tx(b.x+x),z:tz(b.z+z)}}
function rotLocal(x,z,a){return[x*Math.cos(a)+z*Math.sin(a),-x*Math.sin(a)+z*Math.cos(a)]}

/* ---- placing: the notes on paper are static pieces (with the town), the rest are built here ---- */
function townStoryPlace(L,put){
  TS.notes=[];
  for(const b of L.bldgs){const st=TOWN_STORY[b.key];if(!st)continue;
    for(const kind of['note','chart']){const n=st[kind];if(!n)continue;const[dx,dz,h]=n.at,[x,z]=rotLocal(dx,dz,b.ry);
      TS.notes.push({key:b.key+(kind==='chart'?':chart':''),b,n,x:tx(b.x+x),z:tz(b.z+z),y:TW.Y+h});
      if(n.paper)put('TownNote',b.x+x,b.z+z,b.ry+((dx*7+dz*3)%1),h)}}
}
const GLINT_VS=`attribute float on;attribute float seed;uniform float uT;varying float vA;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);
float tw=pow(max(0.,sin(uT*2.1+seed*7.)),6.);vA=on*(0.25+tw);gl_PointSize=on>0.?(16.+tw*26.)/max(0.4,-mv.z)*4.:0.;gl_Position=projectionMatrix*mv;}`;
const GLINT_FS=`varying float vA;void main(){vec2 c=gl_PointCoord-0.5;float d=length(c)*2.;if(d>1.)discard;float s=max(0.,1.-abs(c.x)*16.)+max(0.,1.-abs(c.y)*16.);
gl_FragColor=vec4(vec3(2.2,1.8,1.0)*vA*(pow(1.-d,2.)+s*(1.-d)),1.);}`;
function townStoryBuild(grp,L){
  TS.finds.clear();TS.door=TS.lever=null;TS.doorOpenT=-1;
  const glintPos=[],glintSeed=[];
  for(const b of L.bldgs){const st=TOWN_STORY[b.key];if(!st||!st.find)continue;const f=st.find,[dx,dz,h]=f.at,p=bLocal(b,dx,dz);
    const e={key:b.key,b,f,x:p.x,z:p.z,y:TW.Y+h,g:null,gi:glintPos.length/3};TS.finds.set(b.key,e);glintPos.push(p.x,TW.Y+h+0.12,p.z);glintSeed.push(e.gi);
    loadModel('TownFind_'+b.key).then(({meshes})=>{if(grp!==townGroup)return;const g=new T.Group();for(const m of meshes){const k=new T.Mesh(m.geometry,m.material);k.applyMatrix4(m.matrix);g.add(k)}
      g.position.set(p.x,TW.Y+h,p.z);g.rotation.y=b.ry+dx;g.scale.setScalar(1.5);grp.add(g);e.g=g;g.visible=!TST.sigs[b.key]}).catch(()=>{})}
  // a twinkle over each find not yet taken, so a glance around a room with the light on shows there's something in it
  const gg=new T.BufferGeometry();gg.setAttribute('position',new T.Float32BufferAttribute(glintPos,3));gg.setAttribute('seed',new T.Float32BufferAttribute(glintSeed,1));gg.setAttribute('on',new T.Float32BufferAttribute(glintSeed.map(()=>1),1));
  TS.glint=new T.Points(gg,new T.ShaderMaterial({vertexShader:GLINT_VS,fragmentShader:GLINT_FS,uniforms:{uT:{value:0}},transparent:true,depthWrite:false,blending:T.AdditiveBlending}));TS.glint.frustumCulled=false;TS.glint.userData.own=true;grp.add(TS.glint);
  // Lil's vault: the door in its doorway (hinged on the tunnel's left), a warm light inside that comes up when it opens
  const vb=L.bldgs[L.vault],side=Object.keys(vb.doors).find(s=>vb.doors[s]),D=SIM.townDoor(vb,side);TS.vb=vb;
  const ry=Math.atan2(D.nx,D.nz),pv=new T.Group();   // ry: the door's face (local +z) looks out of the vault
  const hx=-Math.cos(ry)*1.0,hz=Math.sin(ry)*1.0;   // the hinge: 1 m to the door's left (its local -x)
  pv.position.set(tx(D.x)+hx,TW.Y,tz(D.z)+hz);pv.rotation.y=ry;grp.add(pv);TS.door=pv;TS.doorPos={x:tx(D.x)+D.nx*0.9,z:tz(D.z)+D.nz*0.9,nx:D.nx,nz:D.nz,ry};
  loadModel('TownVaultDoor').then(({meshes})=>{for(const m of meshes){const k=new T.Mesh(m.geometry,m.material);k.applyMatrix4(m.matrix);pv.add(k)}}).catch(()=>{});
  TS.doorA=TST.vault.open?1:0;townDoorPose();
  const vl=new T.PointLight(0xffc060,0,9,2);const c=bLocal(vb,0,0);vl.position.set(c.x,TW.Y+2.4,c.z);grp.add(vl);TS.vaultLight=vl;
  // the cellar's counterweight lever: pivot on the east wall
  const cb=L.bldgs.find(b=>b.key==='cellar'),hw=cb.W/2-0.15,lp=bLocal(cb,hw-0.17,-1.15),lv=new T.Group();lv.position.set(lp.x,TW.Y+1.1,lp.z);lv.rotation.y=cb.ry;grp.add(lv);
  const arm=new T.Group();lv.add(arm);TS.lever=arm;TS.leverPos={x:lp.x,z:lp.z,b:cb};TS.leverA=TST.vault.lever?1:0;arm.rotation.x=-TS.leverA*1.9;
  loadModel('TownLever').then(({meshes})=>{for(const m of meshes){const k=new T.Mesh(m.geometry,m.material);k.applyMatrix4(m.matrix);arm.add(k)}}).catch(()=>{});
  // Lil's gold bars: on the plinth until somebody carries one off
  const bar=townBarGeo(),gm=new T.MeshStandardMaterial({color:0xe0b84a,roughness:0.32,metalness:0.35,emissive:0x2a1c04,flatShading:true});
  TS.bars=[];for(let i=0;i<SIM.TOWN_BARS;i++){const m=new T.Mesh(bar,gm);m.userData.own=true;grp.add(m);TS.bars.push(m)}
  townBarsPose();
}
function townStoryBuilt(grp,gs){}   // (the static pieces have loaded; nothing to add yet)
function townBarGeo(){   // a trapezoid ingot, 28 x 9 x 7 cm (shown a touch bigger), narrower on top
  const g=new T.BoxGeometry(0.34,0.1,0.14),p=g.attributes.position;
  for(let i=0;i<p.count;i++)if(p.getY(i)>0){p.setX(i,p.getX(i)*0.82);p.setZ(i,p.getZ(i)*0.72)}
  g.computeVertexNormals();return g;
}
function townPlinthSpot(i){const L=townLay(),vb=L.bldgs[L.vault];return bLocal(vb,2.52+(i%3-1)*0.42,2.58+(i<3?-0.17:0.17))}
function townBarsPose(){
  TST.bars.forEach((b,i)=>{const m=TS.bars[i];if(!m)return;m.visible=b.at!=='up';
    if(b.held!=null){const mine=b.held===myId();let x,z,y,r;
      if(mine){const fx=-Math.sin(P.fa),fz=-Math.cos(P.fa);x=P.x-fx*0.45;z=P.z-fz*0.45;y=P.y+0.85;r=P.fa}   // in your arms, in front of you
      else{const R=remotes.get(b.held);if(!R||!R.tn){m.visible=false;return}const g=R.p.g.position;r=R.p.g.rotation.y;x=g.x+Math.sin(r)*0.45;z=g.z+Math.cos(r)*0.45;y=g.y+0.85}
      m.position.set(x,y,z);m.rotation.set(0,r,0)}
    else if(b.at==='v'){const p=townPlinthSpot(i);m.position.set(p.x,TW.Y+0.66,p.z);m.rotation.set(0,TS.vb?TS.vb.ry:0,0)}
    else if(Array.isArray(b.at)){m.position.set(tx(b.at[0]),TW.Y+0.05,tz(b.at[1]));m.rotation.set(0,i*1.3,0)}});
}
function townDoorPose(){if(!TS.door)return;const a=TS.doorA,e=a*a*(3-2*a);TS.door.rotation.y=TS.doorPos.ry+e*1.75}

/* ---- what you're near ---- */
function townCarrying(){return TST.bars.some(b=>b.held!=null&&b.held===myId())}
function townCarriedBar(){return TST.bars.findIndex(b=>b.held!=null&&b.held===myId())}
function townStorySpot(){
  if(!TS.door)return null;const L=townLay(),dist=(x,z)=>Math.hypot(x-P.x,z-P.z);
  if(townCarrying()){   // your arms are full: you can only put it down (or carry it up a shaft or the stairs: 89-town.js)
    for(const[k,b]of BREACH){const p=shaftPos(b);if(dist(p.x,p.z)<1.8)return null}
    if(dist(tx(L.stair.x),tz(L.stair.z))<3.2)return null;
    return{id:'townDrop',label:'Put the gold bar down'};
  }
  let best=null,bd=STORY_REACH;const near=(d,s)=>{if(d<bd){bd=d;best=s}};
  for(const e of TS.finds.values())if(!TST.sigs[e.key])near(dist(e.x,e.z),{id:'townFind',e,label:`Take: ${e.f.name}`});
  TST.bars.forEach((b,i)=>{if(b.held!=null||b.at==='up'||(b.at==='v'&&!TST.vault.open))return;const m=TS.bars[i];near(dist(m.position.x,m.position.z),{id:'townBar',i,label:'Pick up one of Lil\'s gold bars (45 kg)'})});
  if(!TST.vault.lever&&TS.leverPos)near(dist(TS.leverPos.x,TS.leverPos.z)-0.3,{id:'townLever',label:'Pull the counterweight lever'});
  if(!TST.vault.open)near(dist(TS.doorPos.x,TS.doorPos.z)-0.4,{id:'townVault',label:'Lil\'s vault door'});
  for(const n of TS.notes)near(dist(n.x,n.z)+0.15,{id:'townNote',n,label:`Read: ${n.n.title}`});
  return best;
}
function townStoryUse(s){
  if(s.id==='townNote'){townRead(s.n);return true}
  if(s.id==='townFind'){
    const f=s.e.f;if(f.val&&S.sack.length>=sackMax()){toast(`Your sack is full (${sackMax()} items). Sell something first.`,'bad',3000);return true}
    townAct({t:'tsig',k:s.e.key});return true}
  if(s.id==='townBar'){townAct({t:'tbar',i:s.i,op:'take'});return true}
  if(s.id==='townDrop'){const i=townCarriedBar();if(i>=0)townAct({t:'tbar',i,op:'drop',x:P.x-TW.X,z:P.z-TW.Z});return true}
  if(s.id==='townLever'){townAct({t:'tvault',s:'lever'});return true}
  if(s.id==='townVault'){townVaultDialog();return true}
  return false;
}
function townRead(n){
  if(!S.townRead.includes(n.key)){S.townRead.push(n.key);addXP(6)}
  DLG.open=true;DLG.who='town';digHeld=false;releaseLock();$('#dlg').hidden=false;
  showNode({name:n.n.title,text:n.n.text(),opts:[{label:'Put it back.',leave:true}]});
  if(n.key==='saloon'||n.key==='lil')setTimeout(()=>toast(`Half of the vault's combination: ${n.key==='saloon'?'18':'87'}.`,'gold',3500),400);
}
/* the vault door: what it wants, and what you can do about it right now */
function townVaultDialog(){
  const v=TST.vault,read=k=>S.townRead.includes(k),opts=[],lines=[];
  lines.push(v.key?`The keyhole: turned (${v.key}).`:S.up.vaultkey?'The keyhole: your brass key looks about right.':'The keyhole: brass, stamped "M & L SAFE CO., Bank of Marlow\'s Landing". The bank would have the key.');
  lines.push(v.d1&&v.d2?'The dial: 18, 87. Set.':`The dial: four numbers, in two halves. ${v.d1?'First half set (18). ':''}${v.d2?'Second half set (87). ':''}${!v.d1&&!read('saloon')?'Somebody wrote the first half down somewhere. ':''}${!v.d2&&!read('lil')?'And the second.':''}`);
  lines.push(v.lever?'The bolts: drawn back. Somebody pulled the counterweight.':'The bolts: three steel bars, held shut by a chain that runs up into the ceiling and away south-west, under the bank.');
  if(!v.key&&S.up.vaultkey)opts.push({label:'Turn the bank manager\'s key.',go:()=>{townAct({t:'tvault',s:'key'});sfx.clank();return null}});
  if(!v.d1&&read('saloon'))opts.push({label:'Spin the dial to 18 (from the IOU in the saloon).',go:()=>{townAct({t:'tvault',s:'d1'});townDialClick();return null}});
  if(!v.d2&&read('lil'))opts.push({label:'Spin the dial to 87 (from Lil\'s diary).',go:()=>{townAct({t:'tvault',s:'d2'});townDialClick();return null}});
  opts.push({label:'Leave it.',leave:true});
  DLG.open=true;DLG.who='town';digHeld=false;releaseLock();$('#dlg').hidden=false;
  showNode({name:'Lil\'s vault door',text:lines.join(' '),opts});
}
function townDialClick(){for(let i=0;i<6;i++)setTimeout(()=>tone(2200+Math.random()*300,0.03,'square',0.04),i*90)}

/* ---- the crew's state changed (from the server, or solo) ---- */
function townStoryState(m){
  for(const e of TS.finds.values())if(e.g)e.g.visible=!TST.sigs[e.key];
  if(TS.glint){const a=TS.glint.geometry.attributes.on;for(const e of TS.finds.values())a.array[e.gi]=TST.sigs[e.key]?0:1;a.needsUpdate=true}
  townBarsPose();
  if(!m){TS.doorA=TST.vault.open?1:0;townDoorPose();TS.leverA=TST.vault.lever?1:0;if(TS.lever)TS.lever.rotation.x=-TS.leverA*1.9;return}
  if(m.t==='tsig'){const st=TOWN_STORY[m.k],f=st&&st.find;
    if(f&&m.byId===myId()){   // it's yours
      if(f.use)toast(TOWN_USE[f.use](),'gold',6000);else{S.sack.push(f.id);toast(`Found: ${f.name} (worth ${f.val} gold).`,'gold',4000)}
      sfx.find();addXP(25);logEv('townFind',{k:m.k});saveSession();
      const n=Object.keys(TST.sigs).length;if(n===SIM.TOWN_SIGS.length){badge('historian');S.seeds+=150;foundGold(150);setTimeout(()=>{sfx.gold();toast('That\'s every building in Marlow\'s Landing searched. Somewhere a historian would cry. +150 gold.','gold',7000)},1500)}}
    else if(f&&S.inTown)toast(`${m.by} found ${f.name.replace(/^The /,'the ')}.`,'',2600)}
  if(m.t==='tvault'){
    if(m.s==='lever'){TS.leverT=0;townRumble(0.5);if(S.inTown)toast(m.by===(S.name||'You')?'The lever drops. Chain rattles away through the ceiling to the north-east, toward the vault, and something heavy thumps.':`Chain rattles through the ceiling: ${m.by} pulled the counterweight.`,'gold',4500)}
    else if(m.s==='key'&&S.inTown)toast(`${m.by} turned the key in Lil's vault door.`,'',3000);
    else if(S.inTown)toast(`${m.by} set ${m.s==='d1'?'the first':'the second'} half of the dial.`,'',3000);
    if(m.vault.open&&TS.doorOpenT<0&&TS.doorA<1)townVaultOpens(m);
    else if(!m.vault.open&&S.inTown){const left=SIM.TOWN_VAULT_STEPS.filter(k=>!TST.vault[k]).length;if(left)setTimeout(()=>toast(`Lil's vault: ${left} more to go.`,'',2500),1200)}}
  if(m.t==='tbar'){
    if(m.held!=null&&m.held===myId())toast('You heave a gold bar into your arms. 45 kg. Walk it to the shaft or the stairwell (F there to climb), or F to put it down.','gold',5000);
    else if(m.at==='up'&&S.inTown)toast(`${m.by} carried a gold bar up to the lake.`,'',3000)}
}
function townVaultOpens(m){
  TS.doorOpenT=0;const d=TS.doorPos?Math.hypot(TS.doorPos.x-P.x,TS.doorPos.z-P.z):99,here=S.inTown&&d<40;
  if(here){badge('safecracker');playAudioClip('doorOpen',1.2,0.55);setTimeout(()=>{townRumble(1);playAudioClip('metalClick',1.4,0.5)},700);setTimeout(()=>{sfx.gold();puff(TS.doorPos.x,TW.Y+0.3,TS.doorPos.z,TS.doorPos.x+TS.doorPos.nx,TS.doorPos.z+TS.doorPos.nz,14)},2600)}
  toast(S.inTown?`Bolts slide. Lil's vault door swings open${m.by?' ('+m.by+' set the last of it)':''}. Gold, a lot of it, and a letter.`:`Down in the buried town, ${m.by} opened Lil's vault.`,'gold',7000);
  logEv('townVault',{});
}
function townRumble(v){if(!S.inTown)return;tone(42,2.6*v+0.5,'sine',0.35*v,28);noise(2.2*v+0.4,140,0.5,0.3*v,'lowpass');setTimeout(()=>sfx.thud(v),500)}

/* ---- up and out with a bar (89-town.js exitTown asks): up the shaft or the stairwell it comes too, as heavy loot on the
   lake; any other way out (the well, a knockout, the console) and it's left where you stood ---- */
function townBarOut(x,z){
  const i=townCarriedBar();if(i<0)return;
  const O=SIM.OLD_TOWN,up=Math.hypot(x-O.x,z-O.z)<20&&!S.ko;
  if(up){const ox=x+1.2,oz=z+1.2;
    if(online())wsSend({t:'tbar',i,op:'up',x:ox,z:oz});
    else{const out=SIM.townApply(TST,{t:'tbar',i,op:'up'},{id:myId(),n:S.name||'You'});if(out){townApplied(out);addProp(SIM.TOWN_BAR_ID0+i,'ingot',ox,oz,SIM.HEAVY.ingot,SIM.HEAVY.ingot);try{sessionStorage.setItem('cgl-town',JSON.stringify(TST))}catch(e){}}}
    setTimeout(()=>toast('You shove the gold bar up over the lip ahead of you. It\'s on the lake now: grab it (aim, hold R) and haul it to the Company Store window.','gold',6500),600)}
  else townAct({t:'tbar',i,op:'drop',x:P.x-TW.X,z:P.z-TW.Z});
}

/* ---- every frame down here ---- */
function townStoryUpdate(dt){
  if(!TS.door)return;
  if(TS.glint)TS.glint.material.uniforms.uT.value=performance.now()/1000;
  if(TS.doorOpenT>=0){TS.doorOpenT+=dt;TS.doorA=Math.min(1,Math.max(0,(TS.doorOpenT-1.6)/3.2));townDoorPose();if(TS.doorA>=1)TS.doorOpenT=-1}   // the bolts first, then the swing
  if(TS.leverT!=null&&TS.leverA<1){TS.leverA=Math.min(1,TS.leverA+dt*1.8);TS.lever.rotation.x=-TS.leverA*TS.leverA*1.9}
  if(TS.vaultLight)TS.vaultLight.intensity=TS.doorA*3.2*(0.95+0.05*Math.sin(performance.now()/300));
  if(townCarrying()||TST.bars.some(b=>b.held!=null))townBarsPose();
}
