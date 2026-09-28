// Build an editable Blockbench camper and a GLB using Blockbench's own web editor/exporter.
// Run from the repo root after npm ci: node art/characters/build-camper.mjs
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('https://web.blockbench.net/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof Cube === 'function' && !!Formats.free, { timeout: 30000 });
  await page.getByText('Generic Model', { exact: true }).click();
  await page.getByText('Create New Model').click();
  await page.locator('input:visible').first().fill('camp-green-lake-camper');
  await page.getByText('Confirm', { exact: true }).click();

  const data = await page.evaluate(async () => {
    const palette = ['#bd7248','#d9ad87','#eee0bc','#47352b','#272524','#507777','#818b88','#fffaf1','#a45c4e'];
    const cv = document.createElement('canvas');cv.width=palette.length*16;cv.height=16;
    const ctx=cv.getContext('2d');palette.forEach((color,i)=>{ctx.fillStyle=color;ctx.fillRect(i*16,0,16,16)});
    const paletteUrl=cv.toDataURL('image/png');
    const tex=new Texture({name:'camper-palette.png'}).fromDataURL(paletteUrl).add();
    tex.uv_width=cv.width;tex.uv_height=cv.height;
    Project.texture_width=cv.width;Project.texture_height=16;
    const root=new Group({name:'Camper',origin:[0,0,0]}).addTo('root').init();
    const torso=new Group({name:'torso',origin:[0,12,0]}).addTo(root).init();
    const head=new Group({name:'head',origin:[0,22,0]}).addTo(torso).init();
    const leftArm=new Group({name:'left_arm',origin:[-4.5,21,0]}).addTo(torso).init();
    const rightArm=new Group({name:'right_arm',origin:[4.5,21,0]}).addTo(torso).init();
    const leftLeg=new Group({name:'left_leg',origin:[-2,11,0]}).addTo(root).init();
    const rightLeg=new Group({name:'right_leg',origin:[2,11,0]}).addTo(root).init();
    const cube=(name,from,to,material,parent,rotation=[0,0,0])=>{
      const c=new Cube({name,from,to,origin:parent.origin.slice(),rotation,color:material}).addTo(parent).init();
      c.applyTexture(tex,true);
      for(const f of Object.values(c.faces))f.uv=[material*16,0,(material+1)*16,16];
      return c;
    };
    // Clothing and outline: a clear silhouette before any fine facial detail.
    cube('jumpsuit torso',[-4.5,12,-2.5],[4.5,22,2.5],0,torso);
    cube('belt',[-4.7,12,-2.65],[4.7,13,2.65],3,torso);
    cube('buckle',[-1,12,2.7],[1,13.1,3],2,torso);
    cube('shirt collar',[-2.3,21.2,-2.7],[2.3,22.5,2.7],2,torso);
    cube('left patch',[-3.2,16,2.6],[-1.2,18,2.85],5,torso);
    cube('right patch',[1.2,16,2.6],[3.2,18,2.85],5,torso);
    cube('neck',[-1.3,21.7,-1.3],[1.3,23.5,1.3],1,head);
    cube('face and head',[-4.4,22.5,-3.3],[4.4,31.3,3.3],1,head);
    cube('left ear',[-5.1,25.2,-0.9],[-4.2,27.6,0.9],1,head);
    cube('right ear',[4.2,25.2,-0.9],[5.1,27.6,0.9],1,head);
    cube('nose',[-0.65,25.4,3.3],[0.65,27.1,4.0],1,head);
    cube('left eye white',[-2.7,27.1,3.34],[-0.9,29.0,3.53],7,head);
    cube('right eye white',[0.9,27.1,3.34],[2.7,29.0,3.53],7,head);
    cube('left pupil',[-1.95,27.3,3.54],[-1.25,28.45,3.65],4,head);
    cube('right pupil',[1.55,27.3,3.54],[2.25,28.45,3.65],4,head);
    cube('left brow',[-3.1,29.55,3.36],[-0.7,30.0,3.58],3,head,[0,0,-7]);
    cube('right brow',[0.7,29.55,3.36],[3.1,30.0,3.58],3,head,[0,0,7]);
    cube('smile',[-1.1,24.0,3.33],[1.1,24.42,3.5],4,head);
    cube('hair fringe',[-3.6,30.55,3.25],[3.6,31.3,3.7],3,head);
    cube('hat brim',[-5.7,31.35,-4.8],[5.7,32.0,4.8],2,head);
    cube('hat crown',[-3.1,31.95,-3.2],[3.1,34.4,3.2],2,head);
    cube('hat band',[-3.2,32.15,-3.3],[3.2,32.75,3.3],5,head);
    // T-pose leaves enough separation for Mixamo to identify wrists and elbows.
    cube('left sleeve',[-10.5,19.35,-2],[-4.45,22.0,2],0,leftArm);
    cube('left hand',[-12.8,19.15,-1.65],[-10.35,22.15,1.65],1,leftArm);
    cube('right sleeve',[4.45,19.35,-2],[10.5,22.0,2],0,rightArm);
    cube('right hand',[10.35,19.15,-1.65],[12.8,22.15,1.65],1,rightArm);
    cube('left trouser leg',[-3.8,2.4,-2.1],[-0.45,12.0,2.1],0,leftLeg);
    cube('right trouser leg',[0.45,2.4,-2.1],[3.8,12.0,2.1],0,rightLeg);
    cube('left boot',[-4.0,0,-2.5],[-0.25,3.4,3.4],3,leftLeg);
    cube('right boot',[0.25,0,-2.5],[4.0,3.4,3.4],3,rightLeg);
    cube('left toe',[-4.1,0,2.0],[-0.15,1.2,3.8],4,leftLeg);
    cube('right toe',[0.15,0,2.0],[4.1,1.2,3.8],4,rightLeg);
    Canvas.updateAll();
    const bbmodel=Codecs.project.compile();
    const glb=await Codecs.gltf.compile({encoding:'binary',embed_textures:true,armature:true,animations:false});
    const bytes=new Uint8Array(glb);let glb64='';for(let i=0;i<bytes.length;i+=8192)glb64+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return {bbmodel,glb64:btoa(glb64),paletteUrl,cubes:Cube.all.length,groups:Group.all.length};
  });
  if (errors.length) throw new Error(errors.join('; '));
  writeFileSync(join(out,'camper.bbmodel'),data.bbmodel);
  writeFileSync(join(out,'camper.glb'),Buffer.from(data.glb64,'base64'));
  writeFileSync(join(out,'camper-palette.png'),Buffer.from(data.paletteUrl.split(',')[1],'base64'));
  await page.evaluate(() => {
    Preview.selected.camera.position.set(34,32,46);
    Preview.selected.controls.target.set(0,17,0);
    Preview.selected.controls.update();
  });
  await page.waitForTimeout(700);
  await page.screenshot({path:join(out,'blockbench-editor.png')});
  console.log(`Blockbench: ${data.cubes} cubes, ${data.groups} groups; saved .bbmodel and .glb`);
} finally { await browser.close(); }
