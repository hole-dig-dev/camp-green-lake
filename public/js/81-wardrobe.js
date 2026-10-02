'use strict';
/* public/js/81-wardrobe.js -- the Wardrobe (JT 2026-10-01: the twenty hats, faces, glasses, outfits and shoes/boots,
   "it's all approved by me"). Escape → Wardrobe: pick each piece; you turn to face the camera while you choose.
   Your picks are saved in this browser (cgl-wardrobe) and everyone sees them (join 'w', 'ward' messages; server.js).
   The pieces are Blender's (art/blender/{hats,faces,glasses,clothes,footwear}.blend; lists in public/<kind>-lab/
   manifest.json, the same ones the preview studios use):
     hat / face / glasses: rigid head-local GLBs on the camper's `head` bone (hide its own hat+hair / eyes+brows+mouth /
       shades)
     top / sleeves / bottoms: one outfit GLB has all three (slots torso/arms/legs) as skinned meshes in the camper's
       bind space; each is rebound to THIS camper's own bones (docs/art/clothes-20.md), hiding Torso/Zipper/Patch,
       the sleeves, the trouser legs. The top is widened for the camper's body type the way upgradePerson widens
       the torso.
     shoes: skinned to the shins the same way, hiding the sneakers.
   A ward value is an index into that list, or -1 for the camper's own (what playerLook gave you). Hat also has -2: no
   hat, just hair. */
const WARD_KINDS=[['hat','Hat','hat-lab','hats'],['face','Face','face-lab','faces'],['glasses','Glasses','glasses-lab','glasses'],
  ['torso','Top','clothes-lab','clothes'],['arms','Sleeves','clothes-lab','clothes'],['legs','Bottoms','clothes-lab','clothes'],['shoes','Shoes & boots','footwear-lab','footwear']];
const WARD_NONE={hat:'Your own hat',face:'Your own face',glasses:'None',torso:'Jumpsuit',arms:'Jumpsuit',legs:'Jumpsuit',shoes:'Camp sneakers'};
const WARD={lists:{},assets:{},open:false,fpWas:false,ready:null};
const wardDefault=()=>({hat:-1,face:-1,glasses:-1,torso:-1,arms:-1,legs:-1,shoes:-1});
function wardClean(w){const o=wardDefault();if(w&&typeof w==='object')for(const k in o){const v=Math.round(Number(w[k]));if(Number.isFinite(v)&&v>=(k==='hat'?-2:-1)&&v<20)o[k]=v}return o}
let MY_WARD=wardDefault();try{MY_WARD=wardClean(JSON.parse(localStorage.getItem('cgl-wardrobe')||'null'))}catch(e){}
WARD.ready=Promise.all([...new Set(WARD_KINDS.map(k=>k[2]))].map(lab=>fetch(lab+'/manifest.json').then(r=>r.json()).then(m=>{WARD.lists[lab]=m}))).catch(()=>{});
const wardList=k=>{const d=WARD_KINDS.find(x=>x[0]===k);return d?WARD.lists[d[2]]||[]:[]};
/* one GLB, loaded once, its colours converted like the camper's (the renderer draws hex colours as-is) */
function wardAsset(dir,slug){
  const url='models/'+dir+'/'+slug+'.glb';if(WARD.assets[url])return WARD.assets[url];
  return WARD.assets[url]=new Promise((res,rej)=>new T.GLTFLoader().load(url,g=>{const seen=new Set();g.scene.traverse(n=>{if(n.isMesh)for(const m of[].concat(n.material))if(m&&!seen.has(m)){seen.add(m);m.color&&m.color.convertLinearToSRGB()}});g.scene.updateMatrixWorld(true);res(g)},undefined,rej));
}
/* what of the camper's own model each slot replaces */
const WARD_HIDES={hat:/_(Bucket|Cowboy|DesertCap|Hair)_/,face:/^CGLCamper_(Eye|Brow|Mouth|Teeth)/,glasses:/_Shades_/,torso:/^CGLCamper_(Torso|Zipper|Patch)$/,arms:/^CGLCamper_[LR]_Sleeve$/,legs:/^CGLCamper_[LR]_Leg$/,shoes:/^CGLCamper_[LR]_(Shoe|Sole)$/};
const _wn=s=>s.replace(/[.]/g,'');
/* put a camper's ward on their model (again from scratch: cheap, it's a handful of meshes) */
function wardApply(p){
  if(!p||!p.model||!p.ward)return;const w=p.ward,m=p.model,seq=p.wardSeq=(p.wardSeq||0)+1;
  for(const o of p.wardObjs||[])o.parent&&o.parent.remove(o);p.wardObjs=[];
  /* undo the last ward's hiding (first person keeps its own record of head pieces in fpWas: 70-player.js fpBody) */
  m.traverse(n=>{if(!n.isMesh||n.userData.wardHid==null)return;if(n.userData.fpWas!==undefined)n.userData.fpWas=n.userData.wardVis;else n.visible=n.userData.wardVis;delete n.userData.wardHid});
  const hide=k=>m.traverse(n=>{if(!n.isMesh||!WARD_HIDES[k].test(n.name)||n.userData.wardHid!=null)return;n.userData.wardHid=k;
    if(n.userData.fpWas!==undefined){n.userData.wardVis=n.userData.fpWas;n.userData.fpWas=false}else{n.userData.wardVis=n.visible;n.visible=false}});
  if(w.hat===-2){hide('hat');m.traverse(n=>{if(n.isMesh&&n.name.includes('_Hair_')&&n.userData.wardHid==='hat'){n.userData.wardVis2=1;if(n.userData.fpWas!==undefined)n.userData.fpWas=true;else n.visible=true}})}
  if(p.pig)p.pig.visible=w.hat<0;   // the top level's pig hat: only over your own look
  WARD.ready.then(()=>{
    if(p.wardSeq!==seq)return;   // changed again meanwhile
    const head=m.getObjectByName('head'),orig=m.getObjectByName('CGLCamper_L_Sleeve');if(!head||!orig||!orig.isSkinnedMesh)return;
    const bones=new Map(orig.skeleton.bones.map((b,i)=>[_wn(b.name),{bone:b,inv:orig.skeleton.boneInverses[i]}]));
    const bt=BODY_TYPES[(p.o||{}).body]||BODY_TYPES.average;
    const rigid=(k,dir)=>{const i=w[k];if(!(i>=0))return;const d=wardList(k)[i];if(!d)return;
      wardAsset(dir,d.slug).then(g=>{if(p.wardSeq!==seq)return;hide(k);const s=g.scene.clone(true);s.traverse(n=>{if(n.isMesh){n.castShadow=true}});head.add(s);if(p===me&&me.fpOn)s.userData.fpWas=true;p.wardObjs.push(s);wardFP(p,s)}).catch(()=>{})};
    rigid('hat','hats');rigid('face','faces');rigid('glasses','glasses');
    const wardSkinned=(g,k,slotOk=()=>true)=>{if(p.wardSeq!==seq)return;
        const src=T.SkeletonUtils?T.SkeletonUtils.clone(g.scene):g.scene.clone(true);src.updateMatrixWorld(true);
        const grp=new T.Group();grp.name='Ward_'+k;const meshes=[];src.traverse(n=>{if(n.isSkinnedMesh)meshes.push(n)});
        for(const n of meshes){let meta=n;while(meta&&!meta.userData.slot)meta=meta.parent;const slot=meta?meta.userData.slot:null;if(!slotOk(slot))continue;
          const match=n.skeleton.bones.map(b=>bones.get(_wn(b.name)));if(match.some(x=>!x))continue;
          n.parent.remove(n);grp.add(n);n.position.set(0,0,0);n.quaternion.identity();n.scale.set(1,1,1);n.updateMatrixWorld(true);
          if(slot==='torso'&&(bt.w!==1||bt.d!==1)){n.geometry=n.geometry.clone().applyMatrix4(new T.Matrix4().makeScale(bt.w,1,bt.d))}   // a wider/narrower camper: the top too
          n.bind(new T.Skeleton(match.map(x=>x.bone),match.map(x=>x.inv.clone())),orig.bindMatrix.clone());
          const mats=[].concat(n.material).map(mt=>{if(mt.skinning)return mt;const c=mt.clone();c.skinning=true;return c});n.material=Array.isArray(n.material)?mats:mats[0];
          n.frustumCulled=false;n.castShadow=true;n.receiveShadow=true}
        if(!grp.children.length)return;hide(k);m.add(grp);p.wardObjs.push(grp);wardFP(p,grp)};
    const skinned=(k,dir,i,slotOk)=>{if(!(i>=0))return;const d=wardList(k)[i];if(!d)return;wardAsset(dir,d.slug).then(g=>wardSkinned(g,k,slotOk)).catch(()=>{})};
    for(const k of['torso','arms','legs']){const i=w[k];skinned(k,'clothes',i,s=>s===k)}
    if(p.gravBoots)wardAsset('footwear','gravity-boots').then(g=>wardSkinned(g,'shoes')).catch(()=>{});else skinned('shoes','footwear',w.shoes,()=>true);   /* gravity boots win (88-gear.js) */
  });
}
/* first person: your own new pieces go where the rest of your body is (70-player.js fpBody) */
function wardFP(p,o){if(p!==me)return;o.traverse(n=>{if(n.isMesh){if(me.fpHide)me.fpHide.push(n);n.layers.set(me.fpOn?FP_HIDE_LAYER:0)}})}
function setMyWard(w){
  MY_WARD=wardClean(w);try{localStorage.setItem('cgl-wardrobe',JSON.stringify(MY_WARD))}catch(e){}
  if(me){me.ward=MY_WARD;wardApply(me)}if(online())wsSend({t:'ward',w:MY_WARD});
}
/* ---- the panel ---- */
function openWardrobe(){
  if(!S.started||!me)return;WARD.open=true;WARD.fpWas=FP;if(FP){FP=false;fpBody(false)}
  let el=document.getElementById('wardrobe');
  if(!el){el=document.createElement('div');el.id='wardrobe';el.className='ui-panel wardrobe';document.body.appendChild(el);
    el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const k=b.dataset.k,d=+b.dataset.d;
      if(b.dataset.act==='done')return closeWardrobe();
      if(b.dataset.act==='random'){const w={};for(const[k2]of WARD_KINDS)w[k2]=Math.floor(Math.random()*21)-1;setMyWard(w);return renderWardrobe()}
      if(b.dataset.act==='reset'){setMyWard(wardDefault());return renderWardrobe()}
      if(b.dataset.act==='outfit'){const n=wardList('torso').length,c=MY_WARD.torso;const v=((c+1+d+n+1)%(n+1))-1;setMyWard({...MY_WARD,torso:v,arms:v,legs:v});return renderWardrobe()}
      if(k){const n=wardList(k).length,lo=k==='hat'?-2:-1,span=n-lo;const v=((MY_WARD[k]-lo+d+span)%span)+lo;setMyWard({...MY_WARD,[k]:v});renderWardrobe()}})}
  el.hidden=false;releaseLock&&releaseLock();renderWardrobe();
}
function wardName(k,v){if(v===-2)return'No hat (hair)';if(v<0)return WARD_NONE[k];const d=wardList(k)[v];return d?String(v+1).padStart(2,'0')+' '+d.name:'…'}
function renderWardrobe(){
  const el=document.getElementById('wardrobe');if(!el)return;
  const row=(k,label)=>`<div class="ward-row"><span class="k">${label}</span><button type="button" data-k="${k}" data-d="-1" aria-label="Previous ${label}">◀</button><span class="v">${wardName(k,MY_WARD[k])}</span><button type="button" data-k="${k}" data-d="1" aria-label="Next ${label}">▶</button></div>`;
  const same=MY_WARD.torso===MY_WARD.arms&&MY_WARD.arms===MY_WARD.legs;
  el.innerHTML=`<h2>Wardrobe</h2><p class="ward-sub">Everyone sees what you pick.</p>`+row('hat','Hat')+row('face','Face')+row('glasses','Glasses')+
    `<div class="ward-row"><span class="k">Whole outfit</span><button type="button" data-act="outfit" data-d="-1" aria-label="Previous outfit">◀</button><span class="v">${same?wardName('torso',MY_WARD.torso):'Mixed'}</span><button type="button" data-act="outfit" data-d="1" aria-label="Next outfit">▶</button></div>`+
    row('torso','Top')+row('arms','Sleeves')+row('legs','Bottoms')+row('shoes','Shoes & boots')+
    `<div class="ward-btns"><button type="button" data-act="random">Random</button><button type="button" data-act="reset">My own look</button><button type="button" data-act="done" class="primary">Done</button></div>`;
}
function closeWardrobe(){if(!WARD.open)return;WARD.open=false;const el=document.getElementById('wardrobe');if(el)el.hidden=true;if(WARD.fpWas){FP=true}tryLock&&tryLock()}
/* while it's open: the camera in front of you, a little above, so you see what you're putting on */
function updateWardrobeCam(){
  if(!WARD.open||!me)return;
  if(S.ko||uiOtherOpen()){closeWardrobe();return}
  const a=P.fa,fx=Math.sin(a),fz=Math.cos(a),y=me.g.position.y;me.g.rotation.y=a;   /* face the way you face (P.fa), turned to the camera */
  camera.position.set(me.g.position.x+fx*3.1-fz*0.9,y+1.55,me.g.position.z+fz*3.1+fx*0.9);camera.lookAt(me.g.position.x-fz*0.45,y+1.0,me.g.position.z+fx*0.45);
}
function uiOtherOpen(){return shopOpen||invOpen||DLG.open||BJ.open||PAUSE.open}
command('wardrobe',{usage:'wardrobe',help:'Open the Wardrobe (hats, faces, glasses, outfits, shoes).',run(){openWardrobe();return'Wardrobe open.'}});
