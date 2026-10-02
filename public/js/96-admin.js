'use strict';
/* public/js/96-admin.js -- admin console commands for testing (JT 2026-10-02: "you should be able to spawn in everything
   you want and need, and game states, with code, flags, commands"). Host only (the test server's DEV_MODE makes everyone
   host). The shared ones go through the server ('adminSet': world.crew, world.camp, world.run) so every screen agrees.
     crew hire|fire all|<name>       crew kit all|<name> shovel,bucket3,... (or none)    crew fill all|<name>
     crew morale all|<name> 0-100    kit shovel,bucket2,dog,...  (your own gear; none clears)
     campup goldScale,pipeTee,...    bank <gold>    day <n>    state
     pipe x,z x,z ...  (from the sifter; pipe from <joint> x,z ... for a branch; pipe clear)   block x z [w d]  (a solid box)
   Also from code: ADMIN.crew('hire','all'), ADMIN.crewKit('all',['shovel','bucket']), ADMIN.kit([...]), ... */
const ADMIN={};
const adminNames=w=>{if(!w||w==='all')return SIM.CREW.slice();const n=SIM.CREW.find(n=>n.toLowerCase().startsWith(String(w).toLowerCase()));return n?[n]:[]};
const adminItems=s=>String(s||'').split(/[,\s]+/).filter(Boolean);
function adminSend(o){if(online())wsSend({t:'adminSet',...o});else adminLocal(o)}
/* solo: the same changes, here */
function adminLocal(o){
  if(o.op==='crew'){const up={};for(const n of SIM.CREW)up[n]={...(CREW_UP[n]||{})};for(const n of o.names){if(o.what==='hire')up[n].hired=true;else if(o.what==='fire')up[n]={};else if(o.what==='kit'){const h=up[n].hired;up[n]=h?{hired:true}:{};for(const k of o.items)if(k!=='none')up[n][k]=true}}crewMsg({up})}
  else if(o.op==='camp'){const c={...CAMP};for(const k of o.items)if(k==='none')for(const q of Object.keys(c))delete c[q];else c[k]=true;campSet(c)}
  else if(o.op==='bank'){RUN.bank=o.v;saveRun()}else if(o.op==='day'){RUN.day=o.v;RUN.quota=SIM.quotaFor(o.v,1);saveRun()}
}
ADMIN.crew=(what,who)=>{adminSend({op:'crew',what,names:adminNames(who)})};
ADMIN.crewKit=(who,items)=>{adminSend({op:'crew',what:'kit',names:adminNames(who),items})};
ADMIN.fill=who=>{for(const b of bots)if(adminNames(who).includes(b.d.n))b.bucket=crewBucketMax(b)};
ADMIN.morale=(who,v)=>{for(const b of bots)if(adminNames(who).includes(b.d.n))b.morale=clamp(+v,0,100)};
const ADMIN_NEEDS={pack:'bucket',pack2:'pack',pack3:'pack2',bucket2:'bucket',bucket3:'bucket2',canteen3:'canteen',spade:'shovel',goldShovel:'shovel',hopper2:'hopper',hopper3:'hopper2'};
ADMIN.kit=items=>{if(items.includes('none'))S.up={};const add=k=>{S.up[k]=true;if(ADMIN_NEEDS[k])add(ADMIN_NEEDS[k])};for(const k of items)if(k!=='none')add(k);if(items.includes('canteen')||items.includes('canteen3'))S.water=waterMax()};
ADMIN.camp=items=>adminSend({op:'camp',items});
ADMIN.bank=v=>adminSend({op:'bank',v:Math.max(0,Math.round(+v))});
ADMIN.day=v=>adminSend({op:'day',v:Math.max(1,Math.round(+v))});
ADMIN.state=()=>({day:RUN.day,bank:RUN.bank,quota:RUN.quota,clock:clockText(),me:Object.keys(S.up),camp:Object.keys(CAMP),
  crew:bots.filter(crewHired).map(b=>`${b.d.n}[${Object.keys(CREW_UP[b.d.n]||{}).filter(k=>k!=='hired').join('+')||'bare'}] ${b.state} m${Math.round(moraleOf(b))}`)});
command('crew',{usage:'crew hire|fire|kit|fill|morale all|<name> [items|0-100]',help:'Admin: set up the crew (free, instant).',
  run([what,who,...rest]){const arg=rest.join(',');what=(what||'').toLowerCase();
    if(what==='hire'||what==='fire'){ADMIN.crew(what,who);return`${what==='hire'?'Hired':'Fired'}: ${adminNames(who).join(', ')}`}
    if(what==='kit'){const items=adminItems(arg);ADMIN.crewKit(who,items);return`Kit for ${adminNames(who).join(', ')}: ${items.join(', ')}`}
    if(what==='fill'){ADMIN.fill(who);return'Buckets full.'}
    if(what==='morale'){ADMIN.morale(who,arg);return`Morale ${arg}.`}
    throw new Error('Usage: crew hire|fire|kit|fill|morale all|<name> [items|0-100]')}});
command('kit',{usage:'kit item,item,... | kit none',help:'Admin: your own gear (S.up), free.',run(a){const it=adminItems(a.join(','));ADMIN.kit(it);return'Your gear: '+(Object.keys(S.up).join(', ')||'none')}});
command('campup',{usage:'campup goldScale,pipeTee,pipePump,pipeSteel,sodaMachine | campup none',help:'Admin: camp upgrades, free.',run(a){ADMIN.camp(adminItems(a.join(',')));return'Camp upgrades set.'}});
command('bank',{usage:'bank <gold>',help:'Admin: set the crew wallet.',run([v]){ADMIN.bank(v);return`Wallet: ${v}.`}});
command('day',{usage:'day <n>',help:'Admin: set the day (and its quota).',run([v]){ADMIN.day(v);return`Day ${v}.`}});
command('state',{usage:'state',help:'Admin: the game state in one line.',run(){return JSON.stringify(ADMIN.state())}});
/* lay pipe through points, PIPE_RUN at a time, round nothing (it stops at anything solid, like laying it by hand) */
ADMIN.pipe=(pts,from)=>{
  const nodes=PIPE.nodes.length?PIPE.nodes.slice():[{x:+(SIM.GOLD.SIFTER.x-1.9).toFixed(2),z:SIM.GOLD.SIFTER.z,p:-1}],add=[];
  let at=from==null?0:from;if(!nodes[at])throw new Error(`No joint ${at} (0 to ${nodes.length-1}).`);
  for(const q of pts){let e=nodes[at];
    for(;;){const d=Math.hypot(q.x-e.x,q.z-e.z);if(d<2)break;const k=Math.min(1,PIPE_RUN/d),n={x:+(e.x+(q.x-e.x)*k).toFixed(2),z:+(e.z+(q.z-e.z)*k).toFixed(2),p:at};
      if(!pipeClear(e.x,e.z,n.x,n.z)){adminPipeSend(add);return`Laid ${add.length} sections; something solid is in the way at (${e.x.toFixed(1)}, ${e.z.toFixed(1)}).`}
      nodes.push(n);add.push(n);at=nodes.length-1;e=n}}
  adminPipeSend(add);return`Laid ${add.length} sections (the pipeline has ${nodes.length-1}).`;
};
function adminPipeSend(add,clear){if(online())wsSend({t:'adminSet',op:'pipe',add,clear:!!clear});{   /* here at once too (the server's copy follows), so a branch can start from a joint just laid */if(clear){PIPE.nodes=[];PIPE.broken={}}if(add.length&&!PIPE.nodes.length)PIPE.nodes.push({x:+(SIM.GOLD.SIFTER.x-1.9).toFixed(2),z:SIM.GOLD.SIFTER.z,p:-1});for(const n of add)PIPE.nodes.push(n);PIPE.dirty=true}}
const adminPts=a=>a.map(w=>{const[x,z]=w.split(',').map(Number);if(!Number.isFinite(x)||!Number.isFinite(z))throw new Error(`"${w}" isn't x,z.`);return{x,z}});
command('pipe',{usage:'pipe x,z x,z ... | pipe from <joint> x,z ... | pipe clear',help:'Admin: lay sand pipe through those points (from the sifter, or a joint).',
  run(a){if((a[0]||'').toLowerCase()==='clear'){adminPipeSend([],true);return'Pipeline cleared.'}
    if((a[0]||'').toLowerCase()==='from')return ADMIN.pipe(adminPts(a.slice(2)),+a[1]);return ADMIN.pipe(adminPts(a))}});
/* a stand-in for a new building: a solid crate-coloured box (this screen only), for testing how the crew get round things */
const ADMIN_BLOCKS=[];
ADMIN.block=(x,z,w=2,d=2)=>{solid(x,z,w,d);const m=new T.Mesh(new T.BoxGeometry(w,2,d),new T.MeshLambertMaterial({color:0x9a7b4f}));m.position.set(x,groundAt(x,z)+1,z);m.castShadow=true;scene.add(m);ADMIN_BLOCKS.push({m,c:colliders[colliders.length-1]});return ADMIN_BLOCKS.length};
ADMIN.unblock=()=>{for(const b of ADMIN_BLOCKS){scene.remove(b.m);const i=colliders.indexOf(b.c);if(i>=0)colliders.splice(i,1)}ADMIN_BLOCKS.length=0};
command('block',{usage:'block x z [w d] | block clear',help:'Admin: a solid box (a stand-in building, this screen only).',
  run([x,z,w,d]){if((x||'').toLowerCase()==='clear'){ADMIN.unblock();return'Blocks gone.'}ADMIN.block(numArg(x,0,-600,600),numArg(z,0,-600,600),numArg(w,2,0.3,40),numArg(d,2,0.3,40));return`Block at ${x}, ${z}.`}});
