import { createView } from './scene.mjs';
import { createAudio } from './audio.mjs';
import { createConsole } from './console.mjs';
import { flyStep } from '/shared/console.mjs';
import { distance, heightAt, nearWater, canWalk, clamp, riverX, gradeName } from '/shared/world.mjs';

const $=id=>document.getElementById(id),canvas=$('world'),view=createView(canvas),sound=createAudio();
const keys=new Set(),query=new URLSearchParams(location.search);
let ws=null,state=null,rules=null,roomCode='',mode='rush',connected=false,joining=false,leaving=false,modalType=null;
let local={x:-25,y:3.15,z:58,yaw:-1.05,pitch:-.16,vy:0,moving:false,headYaw:0,driveYaw:0},tool='shovel',placing=null,left=false;
let lastFrame=performance.now(),lastInput=0,lastDig=0,lastNotice='',lastNoticeAt=0,lastVehicle=null,reconnectAttempts=0;
let mouseMode='idle',rightDragging=false,lastMouse=null,lockPending=false,lockTimer=null;
let forceMovementSync=false;
const shovelGesture={phase:'idle',pull:0,x:0,y:0,at:0,lastMove:0,power:0,released:false};
const bucketAim={x:0,y:0};let snapshotAt=performance.now();
function mudRemaining(){return state?Math.max(0,(state.self.muddyUntil||0)-state.now-(performance.now()-snapshotAt)):0;}
function cancelShovelGesture(){if(['planting','planted','lifting'].includes(shovelGesture.phase))action({type:'shovelCancel'});Object.assign(shovelGesture,{phase:'idle',pull:0,released:false});}
function startShovel(){if(tool!=='shovel'||state.self.vehicle||state.self.cart||state.self.busy||state.self.tumbleUntil>state.now||rocker()||placing)return;
  Object.assign(shovelGesture,{phase:state.self.shovelMass?'loaded':'planting',pull:0,at:performance.now(),lastMove:0,power:0,released:false});
  if(state.self.shovelMass)return;const h=view.groundTarget(local,state);if(!h||distance(local,h)>rules.player.reach){shovelGesture.phase='idle';notice('Look down at nearby dirt, then hold left mouse and pull upward.',false);return;}action({type:'shovelPlant',x:h.x,z:h.z});}
function releaseShovel(){shovelGesture.released=true;if(shovelGesture.phase==='lifting')return;if(state?.self.shovelMass||shovelGesture.phase==='loaded'){const power=performance.now()-shovelGesture.lastMove<160?shovelGesture.power:0;const i=input();send(i);action({type:'shovelThrow',yaw:local.yaw,pitch:local.pitch,power,lob:i.catching});shovelGesture.phase='throwing';}else cancelShovelGesture();}
const devConsole=createConsole({getState:()=>state,getRules:()=>rules,onCommand:line=>connected?action({type:'console',line}):devConsole.write('Reconnect before running commands.','error'),onOpen(){closeModal(false);releaseMouse();$('chat-form').hidden=true;modalType='console';placing=null;updateMouseUI();},onClose(){modalType=null;canvas.focus({preventScroll:true});lockMouse();}});
const palette=['#76bec7','#e7a28c','#b7cf88','#d9b873','#b6a0cc','#72c8b9','#c89565','#88a5dd'];
let profileToken=localStorage.getItem('gf-profile')||crypto.randomUUID();localStorage.setItem('gf-profile',profileToken);
$('name').value=localStorage.getItem('gf-name')||['Dusty McBuckets','Pickaxe Pete','Nugget Ned','Gravel Goblin'][Math.floor(Math.random()*4)];
$('room').value=query.get('room')||'';if(query.get('mode')==='sandbox')$('mode').value='sandbox';
const money=cents=>`$${(cents/100).toLocaleString('en-US',{minimumFractionDigits:cents<100000?2:0,maximumFractionDigits:cents<100000?2:0})}`;
const grams=mg=>(mg/1000).toFixed(3);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cfg=id=>rules?.catalog.find(i=>i.id===id);
function notice(text,ok=true){if(!text)return;if(text===lastNotice&&performance.now()-lastNoticeAt<2200)return;lastNotice=text;lastNoticeAt=performance.now();const el=document.createElement('div');el.className=`notification${ok?'':' error'}`;el.textContent=text;$('notifications').append(el);setTimeout(()=>el.remove(),6500);while($('notifications').children.length>4)$('notifications').firstChild.remove();}
function addChat(name,text){const el=document.createElement('div'),b=document.createElement('b');b.textContent=`${name}: `;el.append(b,document.createTextNode(text));$('chat-log').append(el);while($('chat-log').children.length>5)$('chat-log').firstChild.remove();setTimeout(()=>el.remove(),18000);}
function send(message){if(connected&&ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(message));}
const action=a=>send({type:'action',action:a});
const mouseLocked=()=>document.pointerLockElement===canvas;
function updateMouseUI(){
  const locked=mouseLocked();canvas.classList.toggle('mouse-looking',locked||rightDragging);canvas.dataset.mouseMode=locked?'locked':rightDragging?'dragging':mouseMode;
  $('unlock-mouse').hidden=locked||rightDragging||mouseMode==='drag'||!state||!!modalType||!$('chat-form').hidden;
  $('mouse-help').textContent=mouseMode==='drag'?'Hold right mouse and drag to look. Left mouse plants; drag upward to lift, then release to toss. Tab opens the guide.':'Capture the mouse to look around. Esc releases it.';
  $('drag-look').hidden=mouseMode==='drag';
}
function dragLook(){lockPending=false;clearTimeout(lockTimer);mouseMode='drag';updateMouseUI();}
function lockMouse(entering=false){
  if((!state&&!entering)||modalType||!$('chat-form').hidden||mouseLocked()||lockPending)return;
  canvas.focus({preventScroll:true});mouseMode='drag';updateMouseUI();
  if(typeof canvas.requestPointerLock!=='function'){dragLook();return;}
  lockPending=true;
  try{const p=canvas.requestPointerLock();if(p?.catch)p.catch(()=>dragLook());}catch{dragLook();return;}
  lockTimer=setTimeout(()=>{if(!mouseLocked())dragLook();},800);
}
function releaseMouse(){cancelShovelGesture();left=false;rightDragging=false;lastMouse=null;keys.clear();lockPending=false;clearTimeout(lockTimer);if(document.pointerLockElement)document.exitPointerLock();updateMouseUI();}
document.addEventListener('pointerlockchange',()=>{const locked=mouseLocked();lockPending=false;clearTimeout(lockTimer);if(locked){mouseMode='locked';rightDragging=false;lastMouse=null;}else{if(mouseMode==='locked')mouseMode='idle';left=false;rightDragging=false;lastMouse=null;keys.clear();}updateMouseUI();});
document.addEventListener('pointerlockerror',()=>dragLook());
$('capture-mouse').addEventListener('click',()=>lockMouse());
$('drag-look').addEventListener('click',()=>{releaseMouse();dragLook();canvas.focus({preventScroll:true});});
function code(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=new Uint8Array(8);crypto.getRandomValues(bytes);return Array.from(bytes,b=>chars[b%chars.length]).join('');}
function join(){
  joining=true;connected=false;leaving=false;$('start-btn').disabled=true;$('join-status').textContent='Packing your pan…';
  ws=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/crew`);
  ws.onopen=()=>ws.send(JSON.stringify({type:'join',room:roomCode,name:$('name').value.trim(),token:profileToken,mode,crewSize:Number($('crew-size').value)}));
  ws.onmessage=event=>{
    let msg;try{msg=JSON.parse(event.data);}catch{return;}
    if(msg.type==='welcome'){
      connected=true;joining=false;reconnectAttempts=0;rules=msg.rules;roomCode=msg.room;mode=msg.mode;state=msg.state;snapshotAt=performance.now();
      view.loadWorld(msg.cells);view.sync(state);Object.assign(local,{x:state.self.x,y:state.self.y,z:state.self.z,yaw:state.self.yaw,vy:0,pitch:-.16,headYaw:0,driveYaw:state.self.yaw});lastVehicle=state.self.vehicle;
      $('lobby').hidden=true;$('hud').hidden=false;$('connection').hidden=true;$('start-btn').disabled=false;
      $('room-label').textContent=`${mode==='sandbox'?'PLAYGROUND':'GOLD RUSH'} · ${roomCode}`;
      const u=new URL(location.href);u.searchParams.set('room',roomCode);u.searchParams.set('mode',mode);history.replaceState({},'',u);
      notice(mode==='sandbox'?'Machine Playground: big toys in the yard. A loaner wheelbarrow is beside camp.':'Hold left on dirt and pull up. Hold C, slide your bucket under the dirt, and release left to lob. T places the bucket. R pans creek gravel; Q borrows the barrow.');
      $('join-status').textContent='1–8 prospectors · private rooms · worlds save automatically';$('start-btn').blur();canvas.focus({preventScroll:true});updateHUD();updateMouseUI();return;
    }
    if(msg.type==='snapshot'){
      const previousVehicle=state?.self.vehicle,previousCart=state?.self.cart;state=msg;snapshotAt=performance.now();view.sync(state);
      if(previousCart!==state.self.cart&&state.self.cart)local.pitch=-.48;
      if(placing&&!state.self.kits.includes(placing))placing=null;
      if(forceMovementSync||previousVehicle!==state.self.vehicle){Object.assign(local,{x:state.self.x,y:state.self.y,z:state.self.z,yaw:state.self.yaw,driveYaw:state.self.yaw,headYaw:0,vy:0});lastVehicle=state.self.vehicle;forceMovementSync=false;}
      else {const error=Math.hypot(local.x-state.self.x,local.z-state.self.z);if(error>2.5){local.x=state.self.x;local.z=state.self.z;}else if(error>.28){local.x+=(state.self.x-local.x)*.22;local.z+=(state.self.z-local.z)*.22;}}
      if(modalType==='shop')updateShop();updateHUD();return;
    }
    if(msg.type==='terrain'){view.updateTerrain(msg.patches);return;}
    if(msg.type==='effect'){view.effect(msg.effect,state?.self.id);if(msg.effect.type==='dig'&&msg.effect.player===state?.self.id)sound.dig();if(msg.effect.type==='emote')sound.emote();return;}
    if(msg.type==='result'){
      if(msg.console){devConsole.write(msg.lines||msg.message,msg.ok?'output':'error');if(msg.resync)forceMovementSync=true;return;}
      if(msg.shovel==='planted'&&shovelGesture.phase==='planting')shovelGesture.phase='planted';
      if(msg.shovel==='loaded'){shovelGesture.phase='loaded';if(shovelGesture.released)releaseShovel();}
      if(msg.shovel==='thrown')shovelGesture.phase='idle';
      if(!msg.ok&&['planting','lifting','throwing'].includes(shovelGesture.phase))cancelShovelGesture();
      notice(msg.message,msg.ok);if(msg.gold>.01){sound.gold();view.flashGold();tool='pan';}
      if(msg.ok&&msg.message.includes('set up.'))placing=null;
      return;
    }
    if(msg.type==='notice'){notice(msg.message);if(msg.message.includes('bought'))sound.buy();return;}
    if(msg.type==='chat'){addChat(msg.name,msg.text);return;}
    if(msg.type==='error'){$('join-status').textContent=msg.message;notice(msg.message,false);joining=false;$('start-btn').disabled=false;leaving=true;releaseMouse();ws.close();return;}
  };
  ws.onclose=event=>{
    connected=false;joining=false;left=false;keys.clear();$('start-btn').disabled=false;
    if(!state)releaseMouse();
    if(leaving)return;
    if(event.reason==='Opened on another tab'){$('connection').hidden=false;$('connection').textContent='This prospector opened the game in another tab. Reload here to return.';return;}
    if(state){$('connection').hidden=false;setTimeout(()=>{if(!connected&&!leaving)join();},Math.min(8000,1000+reconnectAttempts++*1000));}
    else $('join-status').textContent='Cannot reach the game server. Run Launch.cmd on the host computer, then try again.';
  };
  ws.onerror=()=>{};
}
$('join-form').addEventListener('submit',event=>{event.preventDefault();const resume=$('resume-key').value.trim();if(resume&&!/^[a-zA-Z0-9-]{16,100}$/.test(resume)){$('join-status').textContent='Paste the full prospector pass from your in-game guide.';return;}if(resume){profileToken=resume;localStorage.setItem('gf-profile',profileToken);$('resume-key').value='';}sound.start();localStorage.setItem('gf-name',$('name').value.trim());roomCode=$('room').value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'')||code();mode=$('mode').value;lockMouse(true);join();});
function nearby(){
  if(!state)return null;
  const v=state.vehicles.find(v=>v.id===state.self.vehicle),source=v?{x:v.x,z:v.z}:local,items=[];
  if(!v)for(const l of rules.landmarks)if(l.id!=='camp'&&distance(source,l)<l.radius)items.push({...l,kind:'landmark',dist:distance(source,l)});
  if(!v)for(const b of state.buckets||[])if(b.owner===state.self.id&&distance(source,b)<3.8)items.push({...b,kind:'bucket',dist:distance(source,b)});
  for(const m of state.machines){const d=distance(source,m);if(d<(v?12:5))items.push({...m,kind:'machine',dist:d});}
  if(!v){for(const c of state.carts||[]){if(c.id===state.self.cart)continue;const d=distance(source,c);if(d<3.8)items.push({...c,kind:'cart',dist:d});}for(const s of state.spills||[]){const d=distance(source,s);if(d<3.8)items.push({...s,kind:'spill',dist:d});}}
  for(const other of state.vehicles){if(other.id===v?.id)continue;if(v&&(v.type==='truck'||other.type!=='truck'))continue;const d=distance(source,other);if(d<(v?13:7))items.push({...other,kind:'vehicle',dist:d});}
  items.sort((a,b)=>a.dist-b.dist);return items[0]||null;
}
function nearCart(){return (state?.carts||[]).filter(c=>c.id===state.self.cart||distance(local,c)<3.8).sort((a,b)=>distance(local,a)-distance(local,b))[0];}
function gripCart(){const c=nearCart();if(c)action({type:'cart',target:c.id});else notice('The loaner wheelbarrow is beside camp. Walk up and press Q.',false);}
function rocker(){if(!state||state.self.vehicle||state.self.cart||state.self.tumbleUntil>state.now||state.self.busy)return null;return state.machines.find(m=>m.type==='rocker'&&m.cargo.mass>.001&&distance(local,m)<5)||null;}
function use(){
  const n=nearby();if(!n){notice('Walk beside the assay, hardware shop, washer, or hauling vehicle.',false);return;}
  if(n.kind==='landmark'){if(n.id==='supplier')openShop();else action({type:'sell'});}
  else if(n.kind==='bucket')action({type:'bucket'});
  else action({type:'interact',target:n.id});
}
function enterVehicle(){const c=nearCart();if(state.self.cart||nearby()?.kind==='cart'){action({type:'cartBrake',target:c.id});return;}if(state.self.vehicle){action({type:'enter'});return;}const v=state.vehicles.filter(v=>distance(local,v)<7).sort((a,b)=>distance(local,a)-distance(local,b))[0];if(v)action({type:'enter',target:v.id});else notice('F parks a nearby wheelbarrow or enters a vehicle.',false);}
function togglePan(){tool='pan';action({type:'pan'});}
function input(){
  const blocked=!!modalType||!$('chat-form').hidden||!connected;
  const catching=!blocked&&keys.has('KeyC')&&tool==='shovel'&&!placing&&!state?.self.bucketPos&&!state?.self.vehicle&&!state?.self.cart&&!state?.self.busy&&!(state?.self.tumbleUntil>state?.now);
  return {type:'input',catching,bucketX:bucketAim.x,bucketY:bucketAim.y,forward:blocked?0:(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),right:blocked?0:(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),yaw:local.yaw,pitch:local.pitch,vertical:blocked?0:(keys.has('Space')?1:0)-(keys.has('ControlLeft')||keys.has('ControlRight')?1:0),sprint:!blocked&&(keys.has('ShiftLeft')||keys.has('ShiftRight')),jump:!blocked&&keys.has('Space')&&!state?.self.busy,help:!blocked&&keys.has('KeyH'),wash:!blocked&&(left||keys.has('Space')),operate:!blocked?rocker()?.id:null};
}
function predict(dt){
  if(!state||!connected)return;const i=input(),s=state.self,v=state.vehicles.find(v=>v.id===s.vehicle);
  if(s.cart||s.tumbleUntil>state.now){const f=Math.min(1,dt*18);local.x+=(s.x-local.x)*f;local.z+=(s.z-local.z)*f;local.y+=(s.y-local.y)*f;local.vy=0;local.moving=!!i.forward;return;}
  if(s.fly&&!v){flyStep(local,i,rules,s.speedScale,dt);local.moving=!!(i.forward||i.right||i.vertical);return;}
  if(v){const c=cfg(v.type);if(i.forward)local.driveYaw-=i.right*dt*.85*Math.sign(i.forward);const speed=c.speed*i.forward*(1-v.cargo.mass/c.capacity*.18),nx=local.x-Math.sin(local.driveYaw)*speed*dt,nz=local.z-Math.cos(local.driveYaw)*speed*dt;if(canWalk(nx,nz,1.5)){local.x=nx;local.z=nz;}local.y=heightAt(local.x,local.z,view.cells);local.yaw=local.driveYaw+local.headYaw;local.moving=!!i.forward;}
  else {let f=i.forward,r=i.right,n=Math.max(1,Math.hypot(f,r));f/=n;r/=n;const speed=(i.sprint?rules.player.sprint:rules.player.speed)*(s.speedScale||1)*(s.upgrades.includes('boots')?1.2:1)*(1-(s.bucketPos?0:s.cargo.mass)/s.capacity*.24)*(s.busy?0:1);const nx=local.x+(-Math.sin(local.yaw)*f+Math.cos(local.yaw)*r)*speed*dt,nz=local.z+(-Math.cos(local.yaw)*f-Math.sin(local.yaw)*r)*speed*dt;if(canWalk(nx,local.z))local.x=nx;if(canWalk(local.x,nz))local.z=nz;const ground=Math.max(.3,heightAt(local.x,local.z,view.cells));if(i.jump&&local.y<=ground+.08)local.vy=5.6*(s.jumpScale||1);local.vy-=15*dt;local.y+=local.vy*dt;if(local.y<ground){local.y=ground;local.vy=0;}local.moving=!!(f||r);}
}
function dig(now){
  if(!state||!connected||modalType||!$('chat-form').hidden||state.self.busy||state.self.cart||state.self.tumbleUntil>state.now||rocker()||placing)return;
  if(tool==='pan'&&!state.self.vehicle){if(now-lastDig>1500){lastDig=now;togglePan();}return;}
  const v=state.vehicles.find(v=>v.id===state.self.vehicle);if(v?.type==='truck')return;
  if(!v)return; // Foot digging uses plant -> mouse pull -> release, one load at a time.
  const hit=view.groundTarget(local,state),reach=v?cfg(v.type).reach:rules.player.reach;
  if(!hit||distance(local,hit)>reach){if(now-lastDig>2000){lastDig=now;notice('Look down at nearby ground to dig.',false);}return;}
  const interval=v?cfg(v.type).digSeconds*1000:state.self.upgrades.includes('shovel')?590:870;
  if(now-lastDig>=interval){lastDig=now;action({type:'dig',x:hit.x,z:hit.z});}
}
function updateHUD(){
  if(!state)return;const s=state.self,v=state.vehicles.find(v=>v.id===s.vehicle),cart=state.carts?.find(c=>c.id===s.cart),mass=v?v.cargo.mass:cart?cart.cargo.mass:s.cargo.mass,capacity=v?cfg(v.type).capacity:cart?cart.capacity:s.capacity;
  $('cash').textContent=money(state.cash);$('gold').textContent=`${grams(s.goldMg)} g in your pouch`;
  $('load').textContent=`${Math.round(mass)} / ${capacity.toLocaleString()} kg`;$('load-progress').style.width=`${Math.min(100,mass/capacity*100)}%`;
  $('tool-label').textContent=placing?'PLACE / '+cfg(placing).name.toUpperCase():cart?'03 / LOANER WHEELBARROW':v?cfg(v.type).name.toUpperCase():s.busy?'02 / GOLD PAN':tool==='pan'?'02 / GOLD PAN':'01 / SHOVEL';
  const status=$('haul-status'),fallen=s.tumbleUntil>state.now;status.hidden=!cart&&!fallen;
  status.classList.toggle('danger',fallen||!!cart&&cart.wobble>.6);
  if(fallen)status.textContent=`BOOTS UP · Hold Space to get up · friend holds H\n${Math.min(100,Math.round(s.aid/2.2*100))}% recovered`;
  else if(cart){const operator=state.players.find(p=>p.id===cart.steadier);status.textContent=`${cart.brake?'PARKED':cart.cargo.mass>cart.safeLoad?'OVERLOADED':'STEADY'} · ${Math.round(Math.hypot(cart.vx,cart.vz)*3.6)} km/h\n${operator?`${operator.name} is steadying the load`:cart.wobble>.5?'WOBBLING — brake before turning!':'Space · Brake   F · Park   Q · Let go'}`;}
  const crew=$('crew');crew.replaceChildren();for(const p of state.players){const row=document.createElement('div'),dot=document.createElement('span');dot.className='crew-dot';dot.style.background=palette[p.color];row.append(dot,document.createTextNode(`${p.name}${p.id===s.id?' (you)':''}`));crew.append(row);}
  const b=s.busy;$('pan-guide').hidden=!b;if(b){const settle=b.progress>=.879;$('pan-stage').textContent=settle?'Let the heavies settle':'Wash away the gravel';$('pan-instruction').textContent=settle?'Release mouse / Space. Let the gold settle.':'Hold mouse or Space to swirl the pan.';$('pan-progress').style.width=`${(b.progress+Math.min(1,b.settle/1.05)*.12)*100}%`;}
}
function updateContext(){
  if(!state)return;const n=nearby(),s=state.self,v=state.vehicles.find(v=>v.id===s.vehicle),cart=state.carts?.find(c=>c.id===s.cart),mass=v?v.cargo.mass:cart?cart.cargo.mass:s.cargo.mass,hit=view.groundTarget(local,state),fallenFriend=state.players.find(p=>p.id!==s.id&&p.tumbleUntil>state.now&&distance(local,p)<2.8);let text='';
  if(placing)text=`Click to place ${cfg(placing).name}\nEsc cancels`;
  else if(s.tumbleUntil>state.now)text='Hold Space · Get back up   Friend holds H · Help';
  else if(s.busy)text='R cancels panning';
  else if(input().catching)text='CATCH STANCE · Move mouse to slide the bucket under falling dirt\nRelease left to lob · Keep holding C to catch · Misses can hit your face';
  else if(s.shovelMass>0)text=`${s.shovelMass} kg ON THE BLADE · Aim, flick, release left mouse\nHold C + move mouse to catch a lob · T places your bucket`;
  else if(['planting','planted','lifting'].includes(shovelGesture.phase))text=`BLADE IN DIRT · Drag upward to lift · ${Math.min(100,Math.round(shovelGesture.pull/42*100))}%`;
  else if(fallenFriend&&!cart&&!v)text=`${fallenFriend.name} took a tumble!\nHold H · Help them up · ${Math.min(100,Math.round(fallenFriend.aid/2.2*100))}% recovered`;
  else if(n?.kind==='landmark')text=n.id==='supplier'?'E · Browse Mabel’s equipment':'E · Sell gold to Bill';
  else if(n?.kind==='bucket')text=`Your bucket · ${Math.round(n.mass)} / ${n.capacity} kg\nAim dirt into its open top · E / T picks it up`;
  else if(n?.kind==='machine')text=`${cfg(n.type).name} · ${Math.round(n.cargo.mass)} kg waiting\nE · ${mass>.001?'Load gravel':n.goldMg>.01?`Collect ${grams(n.goldMg)} g gold`:'Inspect washer'}${n.type==='rocker'&&n.cargo.mass>0?' · Hold mouse to rock':''} · G packs it`;
  else if(n?.kind==='cart')text=`Loaner wheelbarrow · ${Math.round(n.cargo.mass)} / 180 kg · ${n.brake?'brake on':'brake off'}\n${n.tipped?'G · Right it':n.operator?'Hold H · Steady your friend':'Q · Take handles'}   E · Load   X · Retrieve   F · Brake`;
  else if(n?.kind==='spill')text=`Spilled gravel · ${Math.round(n.cargo.mass)} kg\nE · Recover into your bucket — gold stays in the gravel`;
  else if(cart)text='W/S · Push   Look · Steer   Space · Brake\nQ · Let go   F · Park   X · Retrieve   G · Dump';
  else if(n?.kind==='vehicle')text=`${cfg(n.type).name}\n${!s.vehicle?'F · Drive   ':''}E · Transfer gravel`;
  else if(v)text=v.type==='truck'?'Drive alongside a washer. E tips your load.':'Hold mouse · Excavate   E · Transfer   F · Get out';
  else if(nearWater(local.x,local.z,13))text=`${s.cargo.mass>0?'R · Pan your gravel   ':''}${tool==='shovel'?'Hold left → pull up → toss':'R · Use pan'}${hit&&distance(local,hit)>rules.player.reach?' · Look down':''}`;
  else text=tool==='pan'?'R · Pan gravel on the creek bank   1 · Equip shovel':'Hold left mouse on dirt → pull upward → release to toss\nT · Place / pick up bucket   R · Pan at the creek';
  $('interaction').textContent=text;
  if(placing)$('target-note').textContent=cfg(placing).placementClearance?`Choose a creek bank ${cfg(placing).placementClearance}–10 metres away`:'Choose a creek bank within 10 metres';
  else if(!cart&&hit&&distance(local,hit)<(v?cfg(v.type).reach||5:rules.player.reach))$('target-note').textContent=`GRAVEL · ${Math.max(0,Math.round((heightAt(hit.x,hit.z,{})-hit.y)*100))} cm excavated`;
  else $('target-note').textContent='';
  const deg=((local.yaw*180/Math.PI)%360+360)%360;const bearing=['N','NW','W','SW','S','SE','E','NE'][Math.round(deg/45)%8];$('bearing').textContent=bearing;
  $('place').textContent=local.z<-45?'Ghost Bend':local.x>38?'Fox Hill':local.z<20?'Split Creek':distance(local,{x:-35,z:58})<25?'Fool’s Crossing':'Lower Gravel';
}
function closeModal(relock=true){modalType=null;$('modal').hidden=true;$('modal-content').replaceChildren();if(relock)lockMouse();}
function showModal(type,html){releaseMouse();modalType=type;$('modal-content').innerHTML=html;$('modal').hidden=false;$('modal-panel').scrollTop=0;$('unlock-mouse').hidden=true;}
$('close-modal').addEventListener('click',()=>closeModal());$('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal();});
function openShop(){
  let html=`<div class="shop-heading"><div><span class="eyebrow">MABEL'S HARDWARE</span><h2 class="modal-title">Tools for bigger mistakes.</h2></div><span class="shop-cash" id="shop-cash"></span></div><p class="modal-subtitle">Every purchase uses the crew treasury. Washers arrive as kits; vehicles are delivered to the town yard.</p>`;
  for(const category of ['Hand tools','Washing equipment','Earthmovers']){html+=`<div class="category">${category.toUpperCase()}</div>`;for(const item of rules.catalog.filter(i=>i.category===category))html+=`<div class="shop-row"><div><strong>${item.name}</strong><p>${item.description}</p></div><span class="price" data-price="${item.id}">${money(state.prices?.[item.id]??item.price*100)}</span><button class="buy-button" data-buy="${item.id}">Buy</button></div>`;}
  showModal('shop',html);for(const b of document.querySelectorAll('[data-buy]'))b.addEventListener('click',()=>action({type:'buy',item:b.dataset.buy}));updateShop();
}
function updateShop(){if(!$('shop-cash')||!state)return;$('shop-cash').textContent=money(state.cash);for(const b of document.querySelectorAll('[data-buy]')){const c=cfg(b.dataset.buy),price=state.prices?.[c.id]??c.price*100,owned=c.kind==='personal'&&state.self.upgrades.includes(c.id),locked=c.requires&&!state.unlocked.includes(c.requires);b.disabled=owned||locked||state.cash<price;b.textContent=owned?'Owned':locked?'Locked':'Buy';b.title=locked?`Requires ${cfg(c.requires).name}`:owned?'Already in your pack':state.cash<price?'Find and sell more gold':'';b.classList.toggle('owned',owned);}for(const el of document.querySelectorAll('[data-price]'))el.textContent=money(state.prices[el.dataset.price]);}
function openKits(){
  if(!state)return;const kits=state.self.kits;
  showModal('kits',`<span class="eyebrow">YOUR EQUIPMENT KITS</span><h2 class="modal-title">Set up your operation.</h2><p class="modal-subtitle">Choose a washer, then look at a nearby creek bank and click to place it. Empty washers can be packed with G.</p>${kits.length?kits.map((k,i)=>`<div class="kit-row"><span>${cfg(k).name}</span><button class="plain-button" data-kit="${i}">Place ↗</button></div>`).join(''):'<p class="hint-box">Your pack has no equipment kits. Buy a rocker box from Mabel in town, or pack an empty washer already in the world.</p>'}`);
  for(const b of document.querySelectorAll('[data-kit]'))b.addEventListener('click',()=>{placing=kits[Number(b.dataset.kit)];closeModal();notice(`Look down at the creek bank, then click to place your ${cfg(placing).name}.`);});
}
function openMap(){
  const mapCoord=v=>(v+112)*2,creek=[];for(let z=-112;z<=112;z+=4)creek.push(`${mapCoord(riverX(z))},${mapCoord(z)}`);
  let dots=state.self.samples.map((s,i)=>`<circle cx="${mapCoord(s.x)}" cy="${mapCoord(s.z)}" r="${i?3:5}" fill="${s.grade>.004?'#b0781b':s.grade>.001?'#9b9663':'#8b887e'}"/>`).join('');
  dots+=state.players.map(p=>`<circle cx="${mapCoord(p.x)}" cy="${mapCoord(p.z)}" r="5" fill="${palette[p.color]}" stroke="#443b2e" stroke-width="1.5"/>`).join('');
  const landmarks=rules.landmarks.map(l=>`<rect x="${mapCoord(l.x)-4}" y="${mapCoord(l.z)-4}" width="8" height="8" fill="#63513b"/><text x="${mapCoord(l.x)-9}" y="${mapCoord(l.z)-8}" font-size="8" text-anchor="end" fill="#51462f">${escape(l.name)}</text>`).join('');
  showModal('map',`<span class="eyebrow">PROSPECTOR'S FIELD BOOK</span><h2 class="modal-title">Follow the samples.</h2><p class="modal-subtitle">Gold is buried unevenly. Compare nearby samples and dig deeper into promising ground. Mixing dirt averages the sample's location.</p><div class="map-layout"><svg class="field-map" viewBox="0 0 448 448" aria-label="Field map with your sample results"><defs><pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#c6b797" stroke-width=".6"/></pattern></defs><rect width="448" height="448" fill="url(#grid)"/><polyline points="${creek.join(' ')}" stroke="#7faaa9" stroke-width="26" fill="none"/><polyline points="${creek.join(' ')}" stroke="#abc5ba" stroke-width="1" fill="none"/><text x="24" y="34" font-family="Georgia" font-size="14" fill="#67543b">GHOST BEND</text><text x="310" y="165" font-family="Georgia" font-size="14" fill="#67543b">FOX HILL</text><text x="150" y="246" font-family="Georgia" font-size="14" fill="#67543b">SPLIT CREEK</text><text x="422" y="32" font-size="13" fill="#4e4537">N ↑</text>${landmarks}${dots}<text x="18" y="429" font-size="9" fill="#6c604a">224 × 224 metres · sample dots show recovered gold</text></svg><div><span class="eyebrow">YOUR RECENT SAMPLES</span><div class="map-samples">${state.self.samples.length?state.self.samples.map(s=>`<div class="sample-row"><strong>${s.label}</strong> · ${(s.grade*1000).toFixed(2)} mg/kg<br>${grams(s.goldMg)} g from ${s.mass.toFixed(0)} kg<br><span class="muted">E ${s.x}, S ${s.z}</span></div>`).join(''):'<p class="guide-copy">No samples yet. Dig a bucket of gravel and pan it at the creek. Each pan clean-up records a result here.</p>'}</div></div></div>`);
}
const guideHTML=()=>`<span class="eyebrow">WELCOME TO FOOL'S CROSSING</span><h2 class="modal-title">Learn the ground. Earn the gear.</h2><p class="guide-copy">Walk to the creek. Press T to put your bucket down. Aim at dirt, hold left mouse and drag upward to lift a scoop, then aim into the bucket and release. Fast flicks throw farther; missed dirt can be recovered with E or X. Pick your bucket up with T. Press R near water to fill your pan, hold mouse or Space to wash, then release when it says to settle. Some samples contain nothing. Promising samples can lead to a buried layer of rich gravel. Compare your results on the field map. Sell recovered gold to Bill in town, then spend the crew's earnings at Mabel's.</p><table class="controls-table"><tr><td>W A S D / Arrows</td><td>Walk · Shift sprints · Space jumps</td></tr><tr><td>Mouse</td><td>Look around · hold left on dirt, pull upward, release to toss · hold beside a loaded rocker to operate</td></tr><tr><td>Hold C + move mouse</td><td>Raise and position your bucket. Release a loaded shovel to lob dirt; catch it before it splats your face.</td></tr><tr><td>T</td><td>Place / pick up your bucket · a slow release drops dirt close</td></tr><tr><td>R · 1 · 2</td><td>Start / cancel panning · shovel · pan</td></tr><tr><td>E</td><td>Sell gold, open shop, load gravel, or collect a washer's gold with an empty bucket</td></tr><tr><td>B · G</td><td>Place an equipment kit · pack an empty nearby washer</td></tr><tr><td>F</td><td>Enter / exit a vehicle · W/S drives and A/D steers</td></tr><tr><td>M · Tab · Esc</td><td>Field map · this guide · release mouse or close a menu</td></tr><tr><td>V · Enter · O</td><td>Yeehaw · crew chat · fullscreen</td></tr></table><p class="guide-copy">With an excavator, aim at nearby ground and hold mouse to scoop. Pull alongside a truck or washer and press E to transfer gravel. Drive a loaded truck beside a washer and press E to tip it. Washers hold recovered gold until someone collects it. A rocker needs someone holding the crank; a sluice and wash plant run themselves.</p><div class="hint-box">The pan stays useful for scouting. Larger equipment handles more gravel; your crew still has to find good ground. Digging and purchases are shared. Each player carries their own dirt and recovered gold.</div>${state?`<div class="guide-actions"><button class="plain-button" id="resume">Back to the goldfield</button><button class="plain-button" id="export">Export world JSON</button><button class="plain-button" id="terrain-export">Export terrain OBJ</button><button class="plain-button" id="sound">Sound ${sound.enabled?'on':'off'}</button><button class="plain-button" id="unstuck">Unstick my boots</button><button class="plain-button" id="leave">Leave room</button></div>`:''}`;
function openGuide(){showModal('guide',guideHTML());if(state){const passBox=document.createElement('div');passBox.className='hint-box';const passText=document.createElement('div');passText.textContent='Save your personal prospector pass. Paste it on a new sharing link to restore your inventory.';const passInput=document.createElement('input');passInput.id='miner-pass';passInput.className='link-field';passInput.readOnly=true;passInput.value=profileToken;const copy=document.createElement('button');copy.className='plain-button';copy.textContent='Copy my prospector pass';copy.onclick=async()=>{try{await navigator.clipboard.writeText(profileToken);copy.textContent='Copied';}catch{passInput.select();}};passBox.append(passText,passInput,copy);$('modal-content').insertBefore(passBox,document.querySelector('.guide-actions'));$('resume').onclick=()=>closeModal();const download=(route,ext)=>{const a=document.createElement('a');a.href=`/api/${route}?room=${encodeURIComponent(roomCode)}&token=${encodeURIComponent(profileToken)}`;a.download=`Gold-Fever-${roomCode}.${ext}`;a.click();};$('export').onclick=()=>download('export','json');$('terrain-export').onclick=()=>download('terrain','obj');$('sound').onclick=()=>{$('sound').textContent=`Sound ${sound.toggle()?'on':'off'}`;};$('unstuck').onclick=()=>{action({type:'unstuck'});closeModal();};$('leave').onclick=()=>{leaving=true;ws?.close();state=null;connected=false;closeModal(false);view.reset();$('hud').hidden=true;$('lobby').hidden=false;$('room').value=roomCode;$('connection').hidden=true;};}}
const originalGuide=openGuide;
openGuide=function(){originalGuide();if(!state)return;const content=$('modal-content'),info=document.createElement('div');info.className='hint-box';info.textContent='Wheelbarrow: Q handles · E loads gravel · X retrieves · Space brakes while pushing · F parking brake · G dumps or rights it. Hold H beside a moving cart to steady your friend, or beside a fallen friend to help them up. Alone, hold Space to get up.';content.insertBefore(info,document.querySelector('.guide-actions'));
  if(state.ownerId===state.self.id&&state.crewSize<8){const controls=document.createElement('div');controls.className='crew-settings';const label=document.createElement('label');label.textContent=`Crew capacity: ${state.crewSize}. Increase capacity and equipment prices:`;const select=document.createElement('select');for(let n=state.crewSize+1;n<=8;n++){const o=document.createElement('option');o.value=n;o.textContent=`${n} prospectors`;select.append(o);}const button=document.createElement('button');button.className='plain-button';button.textContent='Increase crew';button.onclick=()=>{action({type:'crewSize',size:Number(select.value)});closeModal();};controls.append(label,select,button);content.insertBefore(controls,document.querySelector('.guide-actions'));}
};
$('lobby-help').onclick=openGuide;
$('invite').onclick=async()=>{
  releaseMouse();let base=location.origin,connection=null;
  try{connection=await(await fetch('/api/connection')).json();if(connection.shareUrl&&['localhost','127.0.0.1'].includes(location.hostname))base=connection.shareUrl;}catch{}
  const u=new URL(base);u.searchParams.set('room',roomCode);u.searchParams.set('mode',mode);
  if(['localhost','127.0.0.1'].includes(new URL(base).hostname)){
    const lan=connection?.lanUrls?.[0];
    showModal('invite',`<span class="eyebrow">BRING A FRIEND</span><h2 class="modal-title">Share your gold rush.</h2><p class="guide-copy">For a friend in another home, run <strong>Share with Friend.cmd</strong> in the game folder, then press Copy invite again. It creates an Internet link without an account.</p>${lan?`<p class="guide-copy">On the same network, your friend can use this address:</p><input class="link-field" readonly value="${escape(lan+'/?room='+roomCode+'&mode='+mode)}">`:''}<p class="guide-copy">Room code: <strong>${roomCode}</strong>. Keep the host computer awake while playing.</p>`);return;
  }
  try{await navigator.clipboard.writeText(u.href);notice('Invite copied. Your friend can open it and enter their name.');lockMouse();}
  catch{showModal('invite',`<span class="eyebrow">YOUR CREW INVITE</span><h2 class="modal-title">Bring a friend.</h2><input class="link-field" id="invite-link" readonly value="${escape(u.href)}"><p class="guide-copy">Copy this link and send it to your friend. It joins room ${roomCode}.</p>`);$('invite-link').select();}
};
window.addEventListener('keydown',e=>{
  if(!state)return;
  if((e.code==='Backquote'||e.key==='~')){e.preventDefault();if(!e.repeat)devConsole.toggle();return;}
  if(devConsole.isOpen){if(e.code==='Escape'){e.preventDefault();devConsole.close();}return;}
  if(!$('chat-form').hidden){if(e.code==='Escape'){$('chat-form').hidden=true;$('chat-input').blur();lockMouse();e.preventDefault();}return;}
  if(e.code==='Escape'){if(placing){placing=null;notice('Placement cancelled.');}else if(modalType)closeModal(false);releaseMouse();return;}
  if(e.code==='Tab'){e.preventDefault();if(modalType)closeModal();else openGuide();return;}
  if(modalType)return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys.add(e.code);
  if(e.repeat)return;
  if(e.code==='KeyC'){bucketAim.x=0;bucketAim.y=0;local.pitch=Math.max(-.08,local.pitch);}
  if(e.code==='KeyE')use();if(e.code==='KeyR'){cancelShovelGesture();togglePan();}if(e.code==='Digit1')tool='shovel';if(e.code==='Digit2'){cancelShovelGesture();tool='pan';}if(e.code==='KeyT')action({type:'bucket'});
  if(e.code==='KeyB')openKits();if(e.code==='KeyM')openMap();if(e.code==='KeyF')enterVehicle();if(e.code==='KeyV')action({type:'emote'});if(e.code==='KeyQ')gripCart();
  if(e.code==='KeyX'){const pile=(state.spills||[]).filter(s=>distance(local,s)<3.8).sort((a,b)=>distance(local,a)-distance(local,b))[0],c=nearCart();if(pile||c)action({type:'retrieve',target:pile?.id||c.id});}
  if(e.code==='KeyG'){const n=nearby(),c=nearCart();if(state.self.cart||n?.kind==='cart')action({type:'cartTip',target:c.id});else if(n?.kind==='machine')action({type:'pack',target:n.id});}
  if(e.code==='KeyO'){if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(()=>{});}
  if(e.code==='Enter'){e.preventDefault();releaseMouse();$('chat-form').hidden=false;$('chat-input').focus();updateMouseUI();}
});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{cancelShovelGesture();keys.clear();left=false;rightDragging=false;lastMouse=null;updateMouseUI();});
canvas.addEventListener('mousedown',e=>{if(!state||modalType||!$('chat-form').hidden)return;e.preventDefault();sound.start();canvas.focus({preventScroll:true});if(e.button===2&&!mouseLocked()){rightDragging=true;lastMouse={x:e.clientX,y:e.clientY};if(mouseMode==='idle')lockMouse();updateMouseUI();return;}lockMouse();if(e.button!==0)return;left=true;lastMouse={x:e.clientX,y:e.clientY};if(placing){const h=view.groundTarget(local,state);if(h)action({type:'deploy',item:placing,x:h.x,z:h.z,yaw:local.yaw});else notice('Look down at a nearby creek bank.',false);}else startShovel();});
window.addEventListener('mouseup',e=>{if(e.button===0){if(left&&shovelGesture.phase!=='idle')releaseShovel();left=false;}if(e.button===2){rightDragging=false;lastMouse=null;updateMouseUI();}});canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('mouseleave',()=>{if(!mouseLocked()&&!left){rightDragging=false;lastMouse=null;updateMouseUI();}});
document.addEventListener('mousemove',e=>{if(modalType||!state||!$('chat-form').hidden)return;const locked=mouseLocked();if(!locked&&!(mouseMode==='drag'&&(rightDragging||left||keys.has('KeyC'))))return;const mx=locked?e.movementX:lastMouse?e.clientX-lastMouse.x:0,my=locked?e.movementY:lastMouse?e.clientY-lastMouse.y:0,dx=mx*.002,dy=my*.002,now=performance.now();lastMouse={x:e.clientX,y:e.clientY};shovelGesture.x=clamp(shovelGesture.x+mx*.003,-.55,.55);shovelGesture.y=clamp(shovelGesture.y-my*.003,-.5,.5);
  if(left&&['planting','planted','lifting','loaded'].includes(shovelGesture.phase)){shovelGesture.power=clamp(Math.hypot(mx,my)/Math.max(8,now-shovelGesture.lastMove)/2.5,0,1);shovelGesture.lastMove=now;if(['planting','planted','lifting'].includes(shovelGesture.phase)){shovelGesture.pull=Math.max(0,shovelGesture.pull-my);return;}}
  if(input().catching){bucketAim.x=clamp(bucketAim.x+mx*.004,-.75,.75);bucketAim.y=clamp(bucketAim.y-my*.004,-.65,.65);return;}
  if(state.self.vehicle){local.headYaw=clamp(local.headYaw-dx,-2.2,2.2);local.yaw=local.driveYaw+local.headYaw;}else local.yaw-=dx;local.pitch=clamp(local.pitch-dy,-1.38,1.38);});
$('chat-form').addEventListener('submit',e=>{e.preventDefault();const text=$('chat-input').value.trim();if(text)send({type:'chat',text});$('chat-input').value='';$('chat-form').hidden=true;$('chat-input').blur();lockMouse();});
function frame(now){const dt=Math.min(.05,(now-lastFrame)/1000);lastFrame=now;predict(dt);if(shovelGesture.phase==='planted'&&left&&shovelGesture.pull>=42&&now-shovelGesture.at>180){shovelGesture.phase='lifting';action({type:'shovelLift',pull:shovelGesture.pull});}shovelGesture.x*=Math.exp(-dt*5);shovelGesture.y*=Math.exp(-dt*5);view.render(dt,now/1000,state,local,tool,left||keys.has('Space'),placing&&!modalType?cfg(placing):null,{...shovelGesture,catching:input().catching,bucketX:bucketAim.x,bucketY:bucketAim.y});const mud=mudRemaining();$('mud-splatter').hidden=mud<=0;$('mud-splatter').style.opacity=Math.min(1,mud/400);if(state){if(now-lastInput>50){send(input());lastInput=now;}if(left)dig(now);updateContext();}requestAnimationFrame(frame);}
requestAnimationFrame(frame);
// Browser automation uses real time because the authoritative host owns the clock.
window.advanceTime=ms=>new Promise(resolve=>setTimeout(resolve,Math.max(1,ms)));
window.render_game_to_text=()=>JSON.stringify({mode:state?(modalType||'goldfield'):'lobby',connected,room:roomCode,rules:mode,mouse:{mode:mouseMode,locked:mouseLocked(),dragging:rightDragging},coordinates:'metres; origin at map centre; +X east, +Y up, +Z south; yaw 0 faces north (-Z)',
  player:state?{...state.self,x:+local.x.toFixed(2),y:+local.y.toFixed(2),z:+local.z.toFixed(2),yaw:+local.yaw.toFixed(3),pitch:+local.pitch.toFixed(3),tool}:null,
  crewCash:state?.cash/100,crewSize:state?.crewSize,players:state?.players,machines:state?.machines,vehicles:state?.vehicles,carts:state?.carts,spills:state?.spills,clods:state?.clods,buckets:state?.buckets,shovelGesture:{...shovelGesture},bucketAim:{...bucketAim,catching:input().catching},mudRemainingMs:Math.round(mudRemaining()),soilVisuals:view.soilVisuals,nearby:nearby(),target:view.groundTarget(local,state),terrainVerticesChanged:Object.keys(view.cells).length,interaction:$('interaction').textContent});
// These are observation/input hooks only; the host validates every action.
window.__goldfever={getState:()=>state,sendAction:action,setLook(yaw,pitch){local.yaw=yaw;local.pitch=clamp(pitch,-1.38,1.38);if(state?.self.vehicle)local.headYaw=clamp(yaw-local.driveYaw,-2.2,2.2);},getLocal:()=>({...local}),openShop,openMap};
window.addEventListener('beforeunload',()=>{leaving=true;ws?.close();});
