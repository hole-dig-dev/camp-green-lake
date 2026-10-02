'use strict';
/* public/js/88-eotd.js -- Employee of the Day (JT 2026-10-01): a board by the main gate (Sol's EmployeeBoard.glb) with a
   framed portrait of four campers or crew members, each in what they're wearing right now, and a plaque under each:
     1 MOST GOLD FOUND (the gold frame)   2 MOST THROWN AROUND   3 LEAST VALUABLE PERSON (the tin one)   4 BIG SPENDER
   The server keeps today's tallies (world.run: found, thrown, spent) and sends the standings ('eotd') as they change;
   at curfew the day's winners are read out and it starts over. found: 84-spend.js foundGold (and the crew's deposits);
   thrown: every time you're sent flying or rolled up (a twister, a blast, a bonk, a tumbleweed), and every crew toss;
   spent: everything bought from the crew wallet (server.js 'wallet' spends). Everyone on today and the hired crew are
   in the running; the Least Valuable Person is whoever found the least.
   Portraits: a snapshot of the person's own model (SkeletonUtils clone, Wardrobe and all) in a little studio, rendered
   to a texture per frame (PORTRAIT_W x PORTRAIT_H); plaques are canvas text. */
const EOTD_AT={x:-6.8,z:30.6,ry:Math.PI/2};   /* just inside the main gate, facing the way in */
const EOTD_SLOTS=[{k:'found',title:'MOST GOLD FOUND',unit:'gold'},{k:'thrown',title:'MOST THROWN AROUND',unit:'times'},{k:'lvp',title:'LEAST VALUABLE PERSON',unit:'gold'},{k:'spent',title:'BIG SPENDER',unit:'gold'}];
const PORTRAIT_W=384,PORTRAIT_H=512;
const EOTD={g:null,photos:[],plaques:[],rts:[],canvases:[],standings:null,shown:'',pScene:null,pCam:null,pT:0,thrownWas:false};
function eotdBuild(){
  if(EOTD.g)return;EOTD.g=new T.Group();EOTD.g.position.set(EOTD_AT.x,baseH(EOTD_AT.x,EOTD_AT.z),EOTD_AT.z);EOTD.g.rotation.y=EOTD_AT.ry;scene.add(EOTD.g);solid(EOTD_AT.x,EOTD_AT.z,0.6,3.3);
  modelParts('EmployeeBoard').then(parts=>{for(const pt of parts){const nm=pt.material.name||'',ph=/^photo(\d)$/.exec(nm),pl=/^plaque(\d)$/.exec(nm);let mat=pt.material;
    if(ph){const i=+ph[1]-1,rt=new T.WebGLRenderTarget(PORTRAIT_W,PORTRAIT_H);rt.texture.encoding=T.LinearEncoding;EOTD.rts[i]=rt;mat=new T.MeshBasicMaterial({map:rt.texture});
      rt.texture.repeat.set(1,-1);rt.texture.offset.set(0,1)}   /* a render target's rows run bottom-up; the board's UVs top-down (Sol: flipY false) */
    if(pl){const i=+pl[1]-1,c=document.createElement('canvas');c.width=512;c.height=128;const tx=new T.CanvasTexture(c);tx.flipY=false;EOTD.canvases[i]={c,tx};mat=new T.MeshBasicMaterial({map:tx})}
    const m=new T.Mesh(pt.geometry,mat);m.castShadow=!ph&&!pl;m.receiveShadow=true;EOTD.g.add(m)}
    EOTD.shown='';}).catch(()=>{});
}
/* who's who: a name → the person to photograph */
function eotdPerson(n){if(!n)return null;if(me&&n===S.name)return me;for(const R of remotes.values())if(R.name===n)return R.p;const b=bots.find(b=>b.d.n===n);return b?b.p:null}
function eotdStudio(){
  if(EOTD.pScene)return;const s=new T.Scene();s.background=new T.Color(0xd9c49a);
  s.add(new T.HemisphereLight(0xfff3dc,0x8a6a44,0.9));const k=new T.DirectionalLight(0xfff0d0,0.7);k.position.set(1.5,3,4);s.add(k);
  EOTD.pScene=s;EOTD.pCam=new T.PerspectiveCamera(28,PORTRAIT_W/PORTRAIT_H,0.1,20);
}
/* a staff photo: head and shoulders, a little from the side */
function eotdPhoto(i,p){
  const rt=EOTD.rts[i];if(!rt)return;eotdStudio();const s=EOTD.pScene;
  for(const o of[...s.children])if(o.userData.sitter)s.remove(o);
  if(p&&p.model){
    /* Object3D.clone copies userData through JSON, and campers keep live objects there (the hand holding a tool, the
       shovel's materials): set them aside for the snapshot, or it recurses forever */
    const ud=[];p.model.traverse(o=>{ud.push([o,o.userData]);o.userData={}});
    let c;try{c=T.SkeletonUtils?T.SkeletonUtils.clone(p.model):p.model.clone(true)}finally{for(const[o,u]of ud)o.userData=u}
    /* first person hides your own head pieces (fpWas holds what they really are): show them in the photo */
    {const src=[],dst=[];p.model.traverse(o=>src.push(o));c.traverse(o=>dst.push(o));if(src.length===dst.length)src.forEach((o,i)=>{if(o.userData.fpWas!==undefined)dst[i].visible=o.userData.fpWas})}
    /* standing for the photo: the Idle clip's first moment, not whatever they're doing (tumbling, digging) */
    {const clip=MODEL.clips&&MODEL.clips.find(k=>k.name==='Idle');if(clip){const mx=new T.AnimationMixer(c);mx.clipAction(clip).play();mx.update(0.2)}}c.userData.sitter=true;c.position.set(0,0,0);c.rotation.set(0,0.35,0);c.traverse(o=>{if(o.isMesh)o.frustumCulled=false;o.layers.set(0)});
    s.add(c);c.updateMatrixWorld(true);const head=c.getObjectByName('head'),hp=new T.Vector3();if(head)head.getWorldPosition(hp);else hp.set(0,1.6,0);
    EOTD.pCam.position.set(hp.x+0.3,hp.y+0.22,hp.z+2.6);EOTD.pCam.lookAt(hp.x,hp.y+0.05,hp.z)}   /* the head bone sits at the neck: frame the face, the hat and the shoulders */
  else{EOTD.pCam.position.set(0,1.4,2);EOTD.pCam.lookAt(0,1.2,0)}   /* nobody: an empty frame */
  const was=renderer.getRenderTarget();renderer.setRenderTarget(rt);renderer.render(s,EOTD.pCam);renderer.setRenderTarget(was);
}
function eotdPlaque(i,title,name,line){
  const P0=EOTD.canvases[i];if(!P0)return;const g=P0.c.getContext('2d');g.fillStyle='#efe4c8';g.fillRect(0,0,512,128);
  g.fillStyle='#3a2a1a';g.textAlign='center';g.font='bold 30px Impact, "Arial Narrow", sans-serif';g.fillText(title,256,40);
  g.font='bold 38px "Arial Narrow", Arial, sans-serif';g.fillStyle='#1d140d';g.fillText(name||'—',256,84);
  g.font='22px "Arial Narrow", Arial, sans-serif';g.fillStyle='#5a4632';g.fillText(line||'',256,114);P0.tx.needsUpdate=true;
}
function eotdSet(st){EOTD.standings=st||null;EOTD.shown=''}
/* the day's over: the winners, read out */
function eotdAnnounce(st){if(!st)return;const L=EOTD_SLOTS.map(sl=>{const w=st[sl.k];return w&&w.n?`${sl.title.toLowerCase().replace(/^\w/,c=>c.toUpperCase())}: ${w.n} (${w.v} ${sl.unit})`:null}).filter(Boolean);
  if(L.length)setTimeout(()=>toast('Employee of the Day! '+L.join(' · '),'gold',8000),1400)}
/* you were sent flying / rolled up: count it (a rising edge of the twister/tumbleweed states, which bonks and blasts use too) */
function eotdThrown(){const t=!!(twSt||tbSt);if(t&&!EOTD.thrownWas&&S.started){if(online())wsSend({t:'thrown'});else{RUN.thrown=RUN.thrown||{};RUN.thrown[S.name]=(RUN.thrown[S.name]||0)+1}}EOTD.thrownWas=t}
function eotdCrewThrown(b){if(!crewPaysHere())return;if(online())wsSend({t:'thrown',crew:b.d.n});else{RUN.thrown=RUN.thrown||{};RUN.thrown[b.d.n]=(RUN.thrown[b.d.n]||0)+1}}
function updateEotd(dt){
  eotdBuild();eotdThrown();
  EOTD.pT-=dt;if(EOTD.pT>0||!EOTD.rts.length||!EOTD.canvases.length)return;EOTD.pT=2;
  if(!nearCam(EOTD_AT.x,EOTD_AT.z,70)&&EOTD.shown)return;   /* only worth redrawing when someone can see it */
  const st=EOTD.standings||{},key=JSON.stringify(st)+'|'+EOTD_SLOTS.map(sl=>{const p=eotdPerson(st[sl.k]&&st[sl.k].n);return p?(p.wardSeq||0)+':'+(p.wardObjs||[]).length+':'+(!!p.model):'-'}).join(',')+'|'+Math.floor(performance.now()/30000);   /* retake when an outfit finishes loading, and every 30 s */
  if(key===EOTD.shown)return;EOTD.shown=key;
  EOTD_SLOTS.forEach((sl,i)=>{const w=st[sl.k];eotdPhoto(i,eotdPerson(w&&w.n));eotdPlaque(i,sl.title,w&&w.n,w&&w.n?`${w.v} ${sl.unit} today`:'Nobody yet today')});
}
