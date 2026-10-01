/* Blender-authored clothes, rebound to the current camper skeleton. No replacement head, rig or physics. */
(async()=>{
 const T=THREE,$=s=>document.querySelector(s),manifest=await fetch('manifest.json').then(r=>r.json());
 if(new URLSearchParams(location.search).has('gallery'))document.body.classList.add('gallery-only');
 const loader=new T.GLTFLoader(),load=url=>new Promise((resolve,reject)=>loader.load(url,resolve,undefined,reject));
 const [camper,...assets]=await Promise.all([load('../models/camper.glb?v=7'),...manifest.map(d=>load(d.file))]);
 const scene=new T.Scene();scene.background=new T.Color(0xe9e0ce);
 scene.add(new T.HemisphereLight(0xcfe2ee,0xc28a52,.62));const key=new T.DirectionalLight(0xfff0d2,1.05);key.position.set(3,6,5);scene.add(key);const rim=new T.DirectionalLight(0xc8ddf4,.25);rim.position.set(-4,4,-3);scene.add(rim);
 const model=camper.scene;scene.add(model);model.updateMatrixWorld(true);
 const seen=new Set();const colors=root=>root.traverse(n=>{if(n.isMesh){for(const m of Array.isArray(n.material)?n.material:[n.material])if(m&&!seen.has(m)){seen.add(m);m.color.convertLinearToSRGB()}}});colors(model);assets.forEach(h=>colors(h.scene));
 model.traverse(n=>{if(n.isMesh&&(/_(Bucket|Cowboy|DesertCap|Hair|Shades)_/.test(n.name)||n.name.includes('_R_Shovel')||/^CGLCamper_(Eye|Brow|Mouth|Teeth|Torso|Zipper|Patch|[LR]_(Sleeve|Leg))/.test(n.name)))n.visible=false});
 const head=model.getObjectByName('head'),original=model.getObjectByName('CGLCamper_L_Sleeve');
 if(!head||!original?.isSkinnedMesh)throw Error('Current camper skeleton missing');
 const normalized=name=>name.replace(/[.]/g,''),boneMap=new Map(original.skeleton.bones.map((b,i)=>[normalized(b.name),{bone:b,inverse:original.skeleton.boneInverses[i]}]));
 const clothes=assets.map((asset,i)=>{
  const group=new T.Group();group.name='Outfit_'+manifest[i].slug;model.add(group);group.visible=false;const meshes=[];
  asset.scene.updateMatrixWorld(true);asset.scene.traverse(n=>{if(n.isMesh)meshes.push(n)});
  for(const n of meshes){
   let meta=n;while(meta&&!meta.userData.slot)meta=meta.parent;if(meta){n.userData.slot=meta.userData.slot;n.userData.surface=meta.userData.surface;n.name='Garment_'+String(i+1).padStart(2,'0')+'_'+n.userData.slot+'_'+(n.userData.surface||n.name)}
   if(!n.isSkinnedMesh||!['torso','arms','legs'].includes(n.userData.slot))throw Error('Unskinned or unassigned garment '+n.name);
   // Garment vertices are exported in camper bind space. Match rest inverse matrices from the actual model,
   // rather than retaining an imported accessory skeleton whose Blender bone rolls may differ.
   const match=n.skeleton.bones.map(b=>{const m=boneMap.get(normalized(b.name));if(!m)throw Error('Unknown clothing bone '+b.name);return m});
   n.parent.remove(n);group.add(n);n.position.set(0,0,0);n.quaternion.identity();n.scale.set(1,1,1);n.updateMatrixWorld(true);
   n.bind(new T.Skeleton(match.map(m=>m.bone),match.map(m=>m.inverse.clone())),original.bindMatrix.clone());
   n.frustumCulled=false;
  }return {scene:group,meshes};
 });
 const [faceManifest,hatManifest,glassesManifest]=await Promise.all(['face','hat','glasses'].map(k=>fetch('../'+k+'-lab/manifest.json').then(r=>r.json())));
 const extras=await Promise.all([faceManifest,hatManifest,glassesManifest].map(list=>Promise.all(list.map(d=>load('../models/'+(list===faceManifest?'faces':list===hatManifest?'hats':'glasses')+'/'+d.slug+'.glb')))));
 const [faces,hats,glasses]=extras;
 for(const [id,list,defs]of [['face',faces,faceManifest],['hat',hats,hatManifest],['glasses',glasses,glassesManifest]]){
  list.forEach((h,i)=>{colors(h.scene);head.add(h.scene);h.scene.visible=id==='face'&&i===0;const o=document.createElement('option');o.value=i;o.textContent=String(i+1).padStart(2,'0')+' '+defs[i].name;$('#'+id).append(o)});
  $('#'+id).onchange=e=>{list.forEach((h,i)=>h.scene.visible=i===+e.target.value);draw()};
 }
 for(const slot of ['torso','arms','legs'])for(const [i,d]of manifest.entries()){const o=document.createElement('option');o.value=i;o.textContent=String(i+1).padStart(2,'0')+' '+d.name;$('#'+slot).append(o)}
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputEncoding=T.LinearEncoding;$('#viewport').append(renderer.domElement);
 const cam=new T.OrthographicCamera(-1,1,1.6,-1.6,.01,30),mixer=new T.AnimationMixer(model);
 let mode='front',angle=0,selected=0,playing=false,action=null;
 const chosen={torso:0,arms:0,legs:0},favorites=new Set(JSON.parse(localStorage.getItem('cgl-clothes-picks')||'[]'));
 function aim(w,h){const span=3.35;cam.left=-span*w/h/2;cam.right=-cam.left;cam.top=span/2;cam.bottom=-span/2;cam.updateProjectionMatrix();cam.position.set(.6,1.75,7);cam.lookAt(0,1.43,0)}
 function render(){const host=$('#viewport'),w=host.clientWidth||600,h=host.clientHeight||560;renderer.setSize(w,h,false);aim(w,h);model.rotation.y=angle;scene.updateMatrixWorld(true);renderer.render(scene,cam)}
 function draw(){render()}
 function apply(){clothes.forEach((h,i)=>{h.scene.visible=Object.values(chosen).includes(i);h.meshes.forEach(n=>n.visible=chosen[n.userData.slot]===i)});$('#mix').textContent='Mix: '+['torso','arms','legs'].map(s=>s+' '+String(chosen[s]+1).padStart(2,'0')).join(' · ');draw()}
 function saved(){const ordered=manifest.filter(d=>favorites.has(d.id));$('#star').textContent=favorites.has(manifest[selected].id)?'★ Saved — remove pick':'☆ Save this pick';$('#saved').textContent=ordered.length?'Your picks: '+ordered.map(d=>String(d.id).padStart(2,'0')).join(', '):'Save a few numbers to compare your favorites.';localStorage.setItem('cgl-clothes-picks',JSON.stringify([...favorites]))}
 function select(i){selected=i;for(const s of ['torso','arms','legs']){chosen[s]=i;$('#'+s).value=i}const d=manifest[i];$('#selectedNumber').textContent=String(d.id).padStart(2,'0')+' / 20';$('#selectedName').textContent=d.name;$('#selectedDescription').textContent=d.description;$('#download').href=d.file;document.querySelectorAll('.card').forEach((n,j)=>n.classList.toggle('selected',i===j));saved();apply()}
 const thumbs=[],r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(320,440);r.outputEncoding=T.LinearEncoding;
 for(let i=0;i<clothes.length;i++){
  clothes.forEach((h,j)=>{h.scene.visible=i===j;h.meshes.forEach(n=>n.visible=true)});const pictures=[];
  for(const rot of [0,-.65]){model.rotation.y=rot;aim(320,440);scene.updateMatrixWorld(true);r.render(scene,cam);pictures.push(r.domElement.toDataURL('image/png'))}
  thumbs.push(pictures);const d=manifest[i],card=document.createElement('button');card.className='card';card.setAttribute('aria-label',String(d.id)+' '+d.name);card.innerHTML=`<span class="pictures"><img alt="${d.name}, front" src="${pictures[0]}"><img alt="${d.name}, side" src="${pictures[1]}"></span><span class="card-label"><span class="number">${String(d.id).padStart(2,'0')}</span><span class="card-name">${d.name}</span><span class="card-meta">Mixable torso · arms · legs</span></span>`;card.onclick=()=>{select(i);if(innerWidth<760&&!document.body.classList.contains('gallery-only'))$('.studio').scrollIntoView({behavior:'smooth'})};$('#grid').append(card);await new Promise(requestAnimationFrame);
 }
 r.dispose();r.forceContextLoss();$('#loading').remove();select(0);
 function pose(name,time=.4){$('#motion').value=name;playing=false;$('#play').textContent='▶ Play movement';mixer.stopAllAction();model.traverse(n=>{if(n.isBone){n.position.copy(rest.get(n).position);n.quaternion.copy(rest.get(n).quaternion);n.scale.copy(rest.get(n).scale)}});action=null;
  const clip=camper.animations.find(a=>a.name===name);if(clip){action=mixer.clipAction(clip);action.play();mixer.update(time)}scene.updateMatrixWorld(true);draw()}
 const rest=new Map();model.traverse(n=>{if(n.isBone)rest.set(n,{position:n.position.clone(),quaternion:n.quaternion.clone(),scale:n.scale.clone()})});
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{mode=b.dataset.view;angle=mode==='side'?-Math.PI/2:mode==='back'?Math.PI:0;$('#turn').value=Math.round(angle*180/Math.PI);document.querySelectorAll('[data-view]').forEach(n=>n.classList.toggle('active',n===b));draw()});
 $('#turn').oninput=e=>{angle=+e.target.value*Math.PI/180;draw()};$('#star').onclick=()=>{const id=manifest[selected].id;if(favorites.has(id))favorites.delete(id);else favorites.add(id);saved()};
 for(const s of ['torso','arms','legs'])$('#'+s).onchange=e=>{chosen[s]=+e.target.value;apply()};
 $('#skin').onchange=e=>{for(const m of seen)if(m.name==='CGL_Skin')m.color.setHex(parseInt(e.target.value,16));draw()};
 $('#motion').onchange=e=>pose(e.target.value);
 $('#play').onclick=()=>{if(!action){$('#motion').value='Walk';pose('Walk',0)}playing=!playing;$('#play').textContent=playing?'Ⅱ Pause movement':'▶ Play movement'};
 let last=performance.now();function tick(now){if(playing){mixer.update(Math.min((now-last)/1000,.05));draw()}last=now;requestAnimationFrame(tick)}requestAnimationFrame(tick);
 new ResizeObserver(draw).observe($('#viewport'));
 window.clothesLab={ready:true,manifest,model,clothes,chosen,select,apply,draw,pose,scene,renderer,cam,thumbs,hats,hatManifest,faces,faceManifest,glasses,glassesManifest,mixer,original};
})().catch(e=>{console.error(e);document.querySelector('#loading').textContent='Could not load clothing: '+e.message});
