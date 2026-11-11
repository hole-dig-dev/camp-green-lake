'use strict';
/* public/js/89-town-map.js -- a map of Marlow's Landing that draws itself as you explore (2026-11-11). Underground, the
   minimap and the J field map show the town instead of the lake: only the streets, tunnels and rooms somebody in the
   crew has walked (the explored grid is the crew's, the server's: sim.js TOWN_MAP, 'tmap'), the names of the buildings
   you've been in, the lit lanterns, the ways out (daylight shafts, the well, the stairwell), Lil's vault, friends down
   here and any gold bar lying about. Over the HUD, while you're down here, the checklist: buildings searched (each
   one's find taken), lanterns lit, and what Lil's vault still needs. */
const TMAP_SEE=7;           // m around you that counts as explored (about what the flashlight shows close up)
const TMAP_PX=5;            // px per metre on the cached town plan
const TM={bits:null,hex:null,plan:null,view:null,dirty:true,queue:[],sendT:0,markT:0,viewT:0,entered:new Set(),el:null,elTxt:''};
try{const o=JSON.parse(sessionStorage.getItem('cgl-town-entered')||'[]');if(Array.isArray(o))for(const k of o)if(typeof k==='string')TM.entered.add(k)}catch(e){}
const TMG=SIM.TOWN_MAP;
function townMapOr(hex,cells){   // the explored grid with these cells added (hex, as the server keeps it)
  const n=Math.ceil(SIM.TOWN_MAP_N/8),a=new Uint8Array(n);for(let i=0;i<n;i++)a[i]=parseInt(hex.substr(i*2,2)||'0',16)||0;
  for(const c of cells)if(c>=0&&c<SIM.TOWN_MAP_N)a[c>>3]|=1<<(c&7);
  let s='';for(let i=0;i<n;i++)s+=(a[i]<16?'0':'')+a[i].toString(16);return s;
}
function tmBits(){if(TM.hex!==TST.map){TM.hex=TST.map;const n=Math.ceil(SIM.TOWN_MAP_N/8);TM.bits=new Uint8Array(n);for(let i=0;i<n;i++)TM.bits[i]=parseInt(TST.map.substr(i*2,2)||'0',16)||0;TM.dirty=true}return TM.bits}
const tmHas=c=>(tmBits()[c>>3]>>(c&7))&1;
const tmCell=(x,z)=>{const i=Math.floor((x-TW.X-TMG.x0)/TMG.cell),j=Math.floor((z-TW.Z-TMG.z0)/TMG.cell);return i<0||j<0||i>=TMG.nx||j>=TMG.nz?-1:j*TMG.nx+i};
function townMapState(m){if(!m||m.t==='tmap'||m.t==='tlamp'||m.t==='tsig'||m.t==='tvault'||m.t==='tbar')TM.dirty=true;townCheckDraw(true)}
function townEntered(b){if(TM.entered.has(b.key))return;TM.entered.add(b.key);TM.dirty=true;try{sessionStorage.setItem('cgl-town-entered',JSON.stringify([...TM.entered]))}catch(e){}}

/* ---- marking where you've been, and telling the crew ---- */
function townMapUpdate(dt){
  if((TM.markT-=dt)<=0){TM.markT=0.3;const fresh=[];
    for(let dz=-TMAP_SEE;dz<=TMAP_SEE;dz+=TMG.cell)for(let dx=-TMAP_SEE;dx<=TMAP_SEE;dx+=TMG.cell){if(dx*dx+dz*dz>TMAP_SEE*TMAP_SEE)continue;
      const x=P.x+dx,z=P.z+dz,c=tmCell(x,z);if(c<0||tmHas(c)||TM.queue.includes(c)||fresh.includes(c))continue;if(townWhere(x,z,true))fresh.push(c)}
    if(fresh.length){TST.map=townMapOr(TST.map,fresh);TM.queue.push(...fresh)}}
  if((TM.sendT-=dt)<=0&&TM.queue.length){TM.sendT=1.5;const c=TM.queue.splice(0,100);if(online())wsSend({t:'tmap',c});else try{sessionStorage.setItem('cgl-town',JSON.stringify(TST))}catch(e){}}
  townCheckDraw(false);
}

/* ---- the plan: every street, room and tunnel (drawn once), shown only through the explored cells ---- */
function tmPlan(){
  if(TM.plan)return TM.plan;const L=townLay(),W=TMG.nx*TMG.cell*TMAP_PX,H=TMG.nz*TMG.cell*TMAP_PX,c=makeOffscreenCanvas(W,H),g=c.getContext('2d');
  const X=x=>(x-TMG.x0)*TMAP_PX,Z=z=>(z-TMG.z0)*TMAP_PX;
  g.lineCap='round';g.lineJoin='round';
  g.strokeStyle='#8a7350';g.lineWidth=(SIM.TOWN.TUN_R*2)*TMAP_PX;for(const t of L.tunnels){g.beginPath();t.pts.forEach((p,i)=>i?g.lineTo(X(p[0]),Z(p[1])):g.moveTo(X(p[0]),Z(p[1])));g.stroke()}
  g.strokeStyle='#5a4630';g.lineWidth=1.5;g.setLineDash([4,5]);for(const t of L.tunnels)if(t.crawl){const a=SIM.townAlong(t.pts,t.crawl[0]),b=SIM.townAlong(t.pts,t.crawl[1]);g.beginPath();g.moveTo(X(a[0]),Z(a[1]));g.lineTo(X(b[0]),Z(b[1]));g.stroke()}g.setLineDash([]);
  const S_=SIM.TOWN.STREET;g.fillStyle='#b39a70';g.fillRect(X(S_.x0),Z(S_.z0),(S_.x1-S_.x0)*TMAP_PX,(S_.z1-S_.z0)*TMAP_PX);
  for(const b of L.bldgs){const q=Math.abs(Math.sin(b.ry))>0.5,w=q?b.D:b.W,d=q?b.W:b.D;
    g.fillStyle=b.key==='vault'?'#8c7a4a':b.key==='well'?'#7a6a50':'#c9b48a';g.fillRect(X(b.x-w/2),Z(b.z-d/2),w*TMAP_PX,d*TMAP_PX);
    g.strokeStyle='#3a2a1c';g.lineWidth=3;g.strokeRect(X(b.x-w/2),Z(b.z-d/2),w*TMAP_PX,d*TMAP_PX);
    for(const side of['N','S','E','W']){if(!b.doors[side])continue;const D=SIM.townDoor(b,side);g.fillStyle=b.key==='vault'?'#2b2f35':'#c9b48a';
      if(D.nx)g.fillRect(X(D.x)-4,Z(D.z)-0.9*TMAP_PX,8,1.8*TMAP_PX);else g.fillRect(X(D.x)-0.9*TMAP_PX,Z(D.z)-4,1.8*TMAP_PX,8)}}
  return(TM.plan=c);
}
function tmView(){   // the plan, cut down to what's been explored (rebuilt at most once a second when it changes)
  const now=performance.now();if(TM.view&&(!TM.dirty||now-TM.viewT<1000))return TM.view;TM.dirty=false;TM.viewT=now;
  const plan=tmPlan(),W=plan.width,H=plan.height;if(!TM.view)TM.view=makeOffscreenCanvas(W,H);const g=TM.view.getContext('2d'),cp=TMG.cell*TMAP_PX;
  g.clearRect(0,0,W,H);g.fillStyle='#000';tmBits();
  for(let j=0;j<TMG.nz;j++)for(let i=0;i<TMG.nx;i++)if(tmHas(j*TMG.nx+i))g.fillRect(i*cp-2,j*cp-2,cp+4,cp+4);   // a little overlap so the edges don't show the grid
  g.globalCompositeOperation='source-in';g.drawImage(plan,0,0);g.globalCompositeOperation='source-over';
  return TM.view;
}
/* drawn instead of the lake (78-hud.js drawMap asks while you're underground) */
function townDrawMap(g,W){
  const L=townLay(),field=fieldMapOpen,half=field?72:Math.max(20,MV*0.22),cx=field?TW.X-4:P.x,cz=field?TW.Z:P.z,k=W/(half*2);
  const X=x=>(x-cx+half)*k,Z=z=>(z-cz+half)*k;
  g.fillStyle='#1d1610';g.fillRect(0,0,W,W);
  g.imageSmoothingEnabled=true;const v=tmView(),s=k/TMAP_PX;g.drawImage(v,X(TW.X+TMG.x0),Z(TW.Z+TMG.z0),v.width*s,v.height*s);
  const seen=(x,z)=>{const c=tmCell(x,z);return c>=0&&tmHas(c)};
  // building names (once you've been in: yours, or anywhere the crew has explored its middle), and a tick when it's been searched
  g.textAlign='center';g.textBaseline='middle';
  for(const b of L.bldgs){const x=tx(b.x),z=tz(b.z);if(!TM.entered.has(b.key)&&!seen(x,z))continue;
    const done=!!TST.sigs[b.key];g.font=`700 ${field?13:10}px "Barlow Condensed",sans-serif`;g.fillStyle=done?'#2f5a2a':'#2b1d12';
    g.fillText((done?'✓ ':'')+b.name,X(x),Z(z)-(b.key==='vault'?8:0));
    if(b.key==='vault'){g.font=`700 ${field?11:9}px "Barlow Condensed",sans-serif`;g.fillStyle=TST.vault.open?'#7a5a10':'#5a1a10';g.fillText(TST.vault.open?'open':`shut: ${SIM.TOWN_VAULT_STEPS.filter(s=>!TST.vault[s]).length} to go`,X(x),Z(z)+7)}}
  // the ways out: daylight
  const out=(x,z,label)=>{if(!seen(x,z))return;g.fillStyle='#f4e7b0';g.strokeStyle='#6a5a2a';g.lineWidth=2;g.beginPath();g.arc(X(x),Z(z),field?7:5,0,6.3);g.fill();g.stroke();
    g.fillStyle='#6a5a2a';g.beginPath();g.moveTo(X(x),Z(z)-4);g.lineTo(X(x)+3.5,Z(z)+2);g.lineTo(X(x)-3.5,Z(z)+2);g.closePath();g.fill();
    if(field){g.font='600 11px "Barlow Condensed",sans-serif';g.fillStyle='#f4e7b0';g.fillText(label,X(x),Z(z)+15)}};
  for(const[kk,b]of BREACH){const p=shaftPos(b);out(p.x,p.z,'shaft up')}
  const w=L.bldgs[L.well];out(tx(w.x),tz(w.z)+2,'well');out(tx(L.stair.x),tz(L.stair.z),'stairwell');
  // lanterns: lit ones glow, the unlit ones you've seen are small dark rings
  SIM.townLamps().forEach((l,i)=>{const x=tx(l.x),z=tz(l.z);if(!seen(x,z))return;const lit=TST.lit.includes(i);
    g.fillStyle=lit?'#ffcf5a':'rgba(0,0,0,0)';g.strokeStyle=lit?'#8a5a10':'#4a3a2a';g.lineWidth=1.5;g.beginPath();g.arc(X(x),Z(z),lit?(field?4.5:3.5):2.5,0,6.3);g.fill();g.stroke()});
  // a ceiling that came down (89-town-danger.js): the tunnel's blocked there
  TD.sags.forEach((s,i)=>{if(TST.caves[i]!==1||!seen(tx(s.x),tz(s.z)))return;const x=X(tx(s.x)),z=Z(tz(s.z));g.fillStyle='#5a3a22';g.beginPath();g.arc(x,z,field?7:5,0,6.3);g.fill();
    g.strokeStyle='#e8742a';g.lineWidth=2;g.beginPath();g.moveTo(x-4,z-4);g.lineTo(x+4,z+4);g.moveTo(x+4,z-4);g.lineTo(x-4,z+4);g.stroke()});
  // gold bars lying about
  TST.bars.forEach(b=>{if(!Array.isArray(b.at)||b.held!=null)return;g.fillStyle='#e0b84a';g.fillRect(X(tx(b.at[0]))-3,Z(tz(b.at[1]))-2,6,4)});
  // friends down here
  for(const R of remotes.values()){if(!R.tn)continue;const p=R.p.g.position,col=playerColorHex(R.ci);g.fillStyle=col;g.strokeStyle='#2b1d12';g.lineWidth=2;g.beginPath();g.arc(X(p.x),Z(p.z),6,0,6.3);g.fill();g.stroke();
    g.fillStyle=readableOn(col);g.font='700 8px "Barlow Condensed",sans-serif';g.fillText(initialsOf(R.name),X(p.x),Z(p.z)+0.5)}
  g.save();g.translate(X(P.x),Z(P.z));g.rotate(-P.fa+Math.PI);g.fillStyle='#e8742a';g.strokeStyle='#2b1d12';g.lineWidth=2;g.beginPath();g.moveTo(0,-9);g.lineTo(6,7);g.lineTo(-6,7);g.closePath();g.fill();g.stroke();g.restore();
  g.font=`700 ${field?14:10}px "Barlow Condensed",sans-serif`;g.textAlign='left';g.textBaseline='top';g.fillStyle='#e9dcc0';g.fillText('MARLOW\'S LANDING',6,5);
}

/* ---- the checklist, under your name while you're down here ---- */
function townCheckDraw(force){
  if(!TM.el){const top=$('#hudTop');if(!top)return;const d=document.createElement('div');d.id='townCheck';d.className='hud-strip ui-panel';d.hidden=true;
    d.style.cssText='width:200px;font-size:13px;line-height:1.35;gap:2px';top.appendChild(d);TM.el=d}
  const show=!!S.inTown&&S.started;if(TM.el.hidden===show)TM.el.hidden=!show;if(!show)return;
  const n=Object.keys(TST.sigs).length,N=SIM.TOWN_SIGS.length,lit=TST.lit.length,LN=SIM.townLamps().length,v=TST.vault,need=SIM.TOWN_VAULT_STEPS.filter(s=>!v[s]);
  const vtxt=v.open?`open · ${TST.bars.filter(b=>b.at==='up').length}/${SIM.TOWN_BARS} bars up top`:`shut · needs ${need.map(s=>({key:'the key',d1:'dial 1',d2:'dial 2',lever:'the counterweight'})[s]).join(', ')}`;
  const t=`<b style="font-size:15px">Marlow's Landing</b><div>${n} of ${N} buildings searched</div><div>${lit} of ${LN} lanterns lit</div><div>Lil's vault: ${vtxt}</div>`;
  if(t!==TM.elTxt||force){TM.elTxt=t;TM.el.innerHTML=t}
}
