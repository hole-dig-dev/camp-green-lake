/* Face-only GLBs built in Blender, attached to the actual camper head bone. No game assets are reshaped here. */
(async()=>{
 const T=THREE,$=s=>document.querySelector(s),manifest=await fetch('manifest.json').then(r=>r.json());
 if(new URLSearchParams(location.search).has('gallery'))document.body.classList.add('gallery-only');
 const loader=new T.GLTFLoader(),load=url=>new Promise((resolve,reject)=>loader.load(url,resolve,undefined,reject));
 const [camper,...faces]=await Promise.all([load('../models/camper.glb?v=7'),...manifest.map(d=>load(d.file))]);
 const scene=new T.Scene();scene.background=new T.Color(0xe9e0ce);
 scene.add(new T.HemisphereLight(0xcfe2ee,0xc28a52,.62));const key=new T.DirectionalLight(0xfff0d2,1.05);key.position.set(3,6,5);scene.add(key);const rim=new T.DirectionalLight(0xc8ddf4,.25);rim.position.set(-4,4,-3);scene.add(rim);
 const model=camper.scene;scene.add(model);
 const seen=new Set();const colors=root=>root.traverse(n=>{if(n.isMesh){n.castShadow=true;if(n.material&&!seen.has(n.material)){seen.add(n.material);n.material.color.convertLinearToSRGB()}}});colors(model);faces.forEach(h=>colors(h.scene));
 model.traverse(n=>{if(n.isMesh&&(/_(Bucket|Cowboy|DesertCap|Hair|Shades)_/.test(n.name)||n.name.includes('_R_Shovel')||/^CGLCamper_(Eye|Brow|Mouth|Teeth)/.test(n.name)))n.visible=false});
 const head=model.getObjectByName('head');if(!head)throw Error('Camper head bone missing');
 const hatManifest=await fetch('../hat-lab/manifest.json').then(r=>r.json());
 const hats=await Promise.all(hatManifest.map(d=>load('../models/hats/'+d.slug+'.glb')));
 hats.forEach((h,i)=>{colors(h.scene);head.add(h.scene);h.scene.visible=false;const o=document.createElement('option');o.value=i;o.textContent=String(i+1).padStart(2,'0')+' '+hatManifest[i].name;$('#hat').append(o)});
 faces.forEach(h=>{head.add(h.scene);h.scene.visible=false});
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputEncoding=T.LinearEncoding;$('#viewport').append(renderer.domElement);
 const cam=new T.OrthographicCamera(-.9,.9,.8,-.8,.01,30);let mode='front',angle=0,selected=0;
 const favorites=new Set(JSON.parse(localStorage.getItem('cgl-face-picks')||'[]'));
 function aim(width,height,view=mode){const wearing=+$('#hat').value>=0;const span=view==='body'?3.55:wearing?1.45:1.20;cam.left=-span*width/height/2;cam.right=-cam.left;cam.top=span/2;cam.bottom=-span/2;cam.updateProjectionMatrix();const y=view==='body'?1.6:wearing?2.50:2.39;cam.position.set(.4,y+.12,7);cam.lookAt(0,y,0)}
 function draw(){const host=$('#viewport'),w=host.clientWidth||600,h=host.clientHeight||500;renderer.setSize(w,h,false);aim(w,h);model.rotation.y=angle;scene.updateMatrixWorld(true);renderer.render(scene,cam)}
 function saved(){const ordered=manifest.filter(d=>favorites.has(d.id));$('#star').textContent=favorites.has(manifest[selected].id)?'★ Saved — remove pick':'☆ Save this pick';$('#saved').textContent=ordered.length?'Your picks: '+ordered.map(d=>String(d.id).padStart(2,'0')).join(', '):'Save a few numbers to compare your favorites.';localStorage.setItem('cgl-face-picks',JSON.stringify([...favorites]));}
 function select(i){selected=i;faces.forEach((h,j)=>h.scene.visible=j===i);const d=manifest[i];$('#selectedNumber').textContent=String(d.id).padStart(2,'0')+' / 20 · '+d.group.toUpperCase();$('#selectedName').textContent=d.name;$('#selectedDescription').textContent=d.description;$('#download').href=d.file;document.querySelectorAll('.card').forEach((n,j)=>n.classList.toggle('selected',i===j));saved();draw();}
 const thumbs=[],r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(260,270);r.outputEncoding=T.LinearEncoding;
 for(let i=0;i<faces.length;i++){
  faces.forEach((h,j)=>h.scene.visible=i===j);const pictures=[];
  for(const rot of [0,-.52]){model.rotation.y=rot;aim(260,270,'front');scene.updateMatrixWorld(true);r.render(scene,cam);pictures.push(r.domElement.toDataURL('image/png'))}
  thumbs.push(pictures);const d=manifest[i],card=document.createElement('button');card.className='card';card.setAttribute('aria-label',String(d.id)+' '+d.name);card.innerHTML=`<span class="pictures"><img alt="${d.name}, front" src="${pictures[0]}"><img alt="${d.name}, side" src="${pictures[1]}"></span><span class="card-label"><span class="number">${String(d.id).padStart(2,'0')}</span><span class="card-name">${d.name}</span><span class="card-meta">${d.group} · cosmetic face</span></span>`;card.onclick=()=>{select(i);if(innerWidth<760&&!document.body.classList.contains('gallery-only'))$('.studio').scrollIntoView({behavior:'smooth'})};$('#grid').append(card);await new Promise(requestAnimationFrame);
 }
 r.dispose();r.forceContextLoss();$('#loading').remove();select(0);
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{mode=b.dataset.view;angle=mode==='side'?-Math.PI/2:mode==='back'?Math.PI:0;$('#turn').value=Math.round(angle*180/Math.PI);document.querySelectorAll('[data-view]').forEach(n=>n.classList.toggle('active',n===b));draw()});
 $('#turn').oninput=e=>{angle=+e.target.value*Math.PI/180;draw()};$('#star').onclick=()=>{const id=manifest[selected].id;if(favorites.has(id))favorites.delete(id);else favorites.add(id);saved()};
 $('#hat').onchange=e=>{hats.forEach((h,i)=>h.scene.visible=i===+e.target.value);draw()};
 $('#skin').onchange=e=>{model.traverse(n=>{if(n.isMesh&&n.material.name==='CGL_Skin')n.material.color.setHex(parseInt(e.target.value,16))});draw()};
 new ResizeObserver(draw).observe($('#viewport'));
 window.faceLab={ready:true,manifest,model,faces,select,draw,scene,renderer,cam,thumbs,hats,hatManifest};
})().catch(e=>{console.error(e);document.querySelector('#loading').textContent='Could not load faces: '+e.message});
