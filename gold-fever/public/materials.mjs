import * as THREE from '/vendor/three.module.js';

// Local CC0 images only. Color images are sRGB; height/normal/roughness are data.
const textures=new Map(),variants=new Map(),all=new Set(),failed=[];
let loaded=0,anisotropy=1;
function imageTexture(name,kind){
  const key=`${name}-${kind}`;if(textures.has(key))return textures.get(key);
  const fallback=document.createElement('canvas');fallback.width=fallback.height=2;
  const ctx=fallback.getContext('2d');ctx.fillStyle=kind==='normal'?'#8080ff':kind==='height'?'#808080':'#ffffff';ctx.fillRect(0,0,2,2);
  const texture=new THREE.CanvasTexture(fallback);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.colorSpace=kind==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;
  texture.anisotropy=anisotropy;texture.name=key;all.add(texture);textures.set(key,texture);
  new THREE.ImageLoader().load(`/assets/materials/${key}.jpg`,image=>{
    // WebGL uses immutable texture storage. Release the 2px fallback allocation
    // before replacing it with a 1024px image, including every UV-repeat variant.
    const related=[...all].filter(t=>t.source===texture.source);
    for(const t of related)t.dispose();
    texture.image=image;for(const t of related)t.needsUpdate=true;loaded++;
  },undefined,()=>failed.push(key));
  return texture;
}
export function maps(name){return name==='ground'||name==='rock'?{color:imageTexture(name,'color'),height:imageTexture(name,'height'),roughness:imageTexture(name,'roughness')}:{color:imageTexture(name,'color'),normal:imageTexture(name,'normal'),roughness:imageTexture(name,'roughness')};}
function repeat(texture,x,y){const key=`${texture.name}:${x}:${y}`;if(!variants.has(key)){const t=texture.clone();t.repeat.set(x,y);variants.set(key,t);all.add(t);}return variants.get(key);}
export function configureMaterials(renderer){anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());for(const t of all){t.anisotropy=anisotropy;t.needsUpdate=true;}}
export function materialMetrics(){return{loaded,total:12,failed:[...failed],anisotropy,surfaceProjection:'world triplanar'};}
export function cloneMaterial(material){const clone=material.clone();clone.onBeforeCompile=material.onBeforeCompile;clone.customProgramCacheKey=material.customProgramCacheKey;return clone;}

let logs,fabric;
function canvasMap(canvas,color=true){const t=new THREE.CanvasTexture(canvas);t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=anisotropy;all.add(t);return t;}
export function logMaterials(){
  if(logs)return logs;
  const bark=document.createElement('canvas');bark.width=bark.height=256;const c=bark.getContext('2d');c.fillStyle='#b7a38c';c.fillRect(0,0,256,256);
  let seed=195;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<1800;i++){const v=110+Math.floor(random()*95);c.fillStyle=`rgba(${v},${v},${v},.16)`;c.fillRect(random()*256,random()*256,1+random()*3,3+random()*14);}
  for(let x=0;x<256;x+=5){c.strokeStyle=x%3?'rgba(55,44,32,.40)':'rgba(239,220,186,.36)';c.lineWidth=1.2+random()*2;c.beginPath();for(let y=0;y<=256;y+=8){const px=x+Math.sin(y*.032+x)*2;y?c.lineTo(px,y):c.moveTo(px,y);}c.stroke();}
  const ends=document.createElement('canvas');ends.width=ends.height=256;const e=ends.getContext('2d');e.fillStyle='#e0c7a0';e.fillRect(0,0,256,256);
  for(let r=7;r<180;r+=5){e.strokeStyle=r%3?'rgba(105,70,36,.38)':'rgba(245,228,190,.65)';e.lineWidth=1.2;e.beginPath();for(let a=0;a<=Math.PI*2+.03;a+=.05){const rr=r+Math.sin(a*6+r)*1.4,x=120+Math.cos(a)*rr,y=137+Math.sin(a)*rr*.93;a?e.lineTo(x,y):e.moveTo(x,y);}e.stroke();}
  const barkMap=canvasMap(bark),barkBump=canvasMap(bark,false);barkMap.repeat.y=barkBump.repeat.y=2;
  logs={bark:new THREE.MeshStandardMaterial({color:'#a88b6b',map:barkMap,bumpMap:barkBump,bumpScale:.04,roughness:1}),cap:new THREE.MeshStandardMaterial({color:'#d8b58c',map:canvasMap(ends),roughness:.94})};return logs;
}
function cloth(material){
  if(!fabric){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#f5f2ec';ctx.fillRect(0,0,128,128);for(let y=0;y<128;y+=4)for(let x=0;x<128;x+=4){ctx.fillStyle=(x+y)%8?'#dcd7cf':'#ebe7e1';ctx.fillRect(x,y,3,1);ctx.fillRect(x,y+1,1,3);}fabric={color:canvasMap(c),height:canvasMap(c,false)};fabric.color.repeat.set(2,2);fabric.height.repeat.set(2,2);}
  material.map=fabric.color;material.bumpMap=fabric.height;material.bumpScale=.008;material.roughness=1;return material;
}

const woodColors=new Set(['#88603d','#523c2b','#825539','#a8784e','#aa9065','#896c54','#65452d']);
const soilColors=new Set(['#725039','#aa8a58','#8e734b','#937147','#95794e','#9b825d','#6e5b3d']);
const metalColors=new Set(['#424b4c','#667070','#384847','#b87946','#bec9cb']);
const paintedColors=new Set(['#d89e39','#d7a346','#bd793f','#bc7440','#9e5037','#77795b','#707c60']);
const clothColors=new Set(['#507d86','#ba6653','#73914f','#a48b51','#837496','#4d9790','#b38555','#667fb8','#414b5b','#525d68','#af3541','#344c87','#775735','#8b673b','#342421']);
export function textureMaterial(material,color){
  if(clothColors.has(color))return cloth(material);
  let name,x=1,y=1;
  if(woodColors.has(color)){name='wood';x=.8;y=1.5;}
  else if(metalColors.has(color)||paintedColors.has(color)){name='metal';x=y=1.3;}
  else if(soilColors.has(color)){name='ground';x=y=2;}
  else if(color==='#969889'){name='rock';x=y=1.5;}
  if(!name)return material;
  const m=maps(name);material.map=repeat(m.color,x,y);material.roughnessMap=repeat(m.roughness,x,y);
  if(m.normal){material.normalMap=repeat(m.normal,x,y);material.normalScale=new THREE.Vector2(name==='wood'?.28:.18,name==='wood'?.28:.18);}
  else{material.bumpMap=repeat(m.height,x,y);material.bumpScale=.025;}
  if(name==='metal'){material.metalness=paintedColors.has(color)?.08:.38;material.roughness=paintedColors.has(color)?.85:.7;}
  // Retain the warm cartoon palette: use scan detail without doubling its darkness.
  material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
    vec4 gfTexel=texture2D(map,vMapUv);
    float gfLuma=dot(gfTexel.rgb,vec3(.2126,.7152,.0722));
    vec3 gfDetail=mix(vec3(gfLuma),gfTexel.rgb,${name==='metal'?'.15':'.3'});
    ${paintedColors.has(color)?'float gfWear=smoothstep(.18,.52,gfLuma);diffuseColor.rgb=mix(diffuseColor.rgb*clamp(gfLuma/.22,.55,1.15),vec3(.105,.074,.045),gfWear*.52);':'diffuseColor.rgb*=clamp(mix(vec3(1.0),gfDetail/'+(name==='wood'?'.22':name==='metal'?'.23':'.28')+',.78),vec3(.36),vec3(1.3));'}
  #endif`);};
  material.customProgramCacheKey=()=>`gf-object-${name}-${paintedColors.has(color)?'worn':'raw'}-2`;return material;
}

// Projection in metres, blended across three axes: no stretched cliff UVs or
// texture resets at chunk boundaries. The collision mesh and excavation stay intact.
export function groundMaterial({mine=false}={}){
  const ground=maps('ground'),rock=maps('rock');
  const material=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:false,roughness:.98,side:mine?THREE.DoubleSide:THREE.FrontSide,map:ground.color,bumpMap:ground.height,bumpScale:.045,roughnessMap:ground.roughness});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{gfRock:{value:rock.color},gfRockHeight:{value:rock.height},gfRockRough:{value:rock.roughness},gfMine:{value:mine?1:0}});
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 gfPosition;\nvarying vec3 gfNormal;').replace('#include <begin_vertex>','#include <begin_vertex>\ngfPosition=(modelMatrix*vec4(transformed,1.0)).xyz;\ngfNormal=normalize(mat3(modelMatrix)*objectNormal);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 gfPosition;varying vec3 gfNormal;
      uniform sampler2D gfRock;uniform sampler2D gfRockHeight;uniform sampler2D gfRockRough;uniform float gfMine;
      vec3 gfWeights(){vec3 w=pow(abs(normalize(gfNormal)),vec3(5.0));return w/max(.0001,w.x+w.y+w.z);}
      /* JT 2026-10-05: no visible tiling. Value noise for (1) randomised tiling, (3) macro variation, (4) ground types. */
      float gfHash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      float gfNoise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);return mix(mix(gfHash(i),gfHash(i+vec2(1,0)),u.x),mix(gfHash(i+vec2(0,1)),gfHash(i+vec2(1,1)),u.x),u.y);}
      float gfFbm(vec2 p){float v=0.0,a=.5;for(int i=0;i<4;i++){v+=a*gfNoise(p);p=p*2.03+vec2(17.1,9.7);a*=.5;}return v;}
      /* (1) randomised tiling (Inigo Quilez's texture-repetition technique): a slow noise picks one of 8 random offsets
         per patch of tiles and blends between neighbours, with explicit gradients so mipmaps don't seam */
      vec4 gfNoTile(sampler2D image,vec2 uv){
        float k=gfNoise(uv*.37),l=k*8.0,fl=fract(l),ia=floor(l),ib=ia+1.0;
        vec2 oa=sin(vec2(3.0,7.0)*ia),ob=sin(vec2(3.0,7.0)*ib),dx=dFdx(uv),dy=dFdy(uv);
        vec4 a=textureGrad(image,uv+oa,dx,dy),b=textureGrad(image,uv+ob,dx,dy);
        return mix(a,b,smoothstep(.2,.8,fl-.1*dot(a.rgb-b.rgb,vec3(1.0))));}
      vec4 gfProject(sampler2D image,vec3 p){vec3 w=gfWeights();vec4 sampled=vec4(0.0);if(w.x>.005)sampled+=gfNoTile(image,p.zy)*w.x;if(w.y>.005)sampled+=gfNoTile(image,p.xz)*w.y;if(w.z>.005)sampled+=gfNoTile(image,p.xy)*w.z;return sampled;}
      float gfRockMix(){return gfMine>.5?1.0:smoothstep(.14,.55,1.0-abs(normalize(gfNormal).y));}
    `);
    // Bump sampler declarations must precede the helper that references them.
    shader.fragmentShader=shader.fragmentShader.replace('#include <bumpmap_pars_fragment>',THREE.ShaderChunk.bumpmap_pars_fragment.replace(/vec2 dHdxy_fwd\(\) \{[\s\S]*?return vec2\( dBx, dBy \);\s*\}/,`float gfHeight(vec3 p){return mix(gfProject(bumpMap,p*.30).r,gfProject(gfRockHeight,p*.24).r,gfRockMix());}
      vec2 dHdxy_fwd(){float h=gfHeight(gfPosition);return bumpScale*vec2(gfHeight(gfPosition+dFdx(gfPosition))-h,gfHeight(gfPosition+dFdy(gfPosition))-h);}`));
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`vec3 gfSoil=gfProject(map,gfPosition*.30).rgb;
      vec3 gfStone=gfProject(gfRock,gfPosition*.24).rgb;
      gfSoil=mix(vec3(dot(gfSoil,vec3(.2126,.7152,.0722))),gfSoil,.45)/.31;
      gfStone=mix(vec3(dot(gfStone,vec3(.2126,.7152,.0722))),gfStone,.36)/.40;
      /* (4) ground types by noise, slope and height: fine sand, gravel, dry scrub; the slope rock and the wet creek
         edge stay as they were */
      vec2 gfW=gfPosition.xz;float gfFlat=1.0-gfRockMix();
      float gfSandN=gfFbm(gfW*.035+vec2(3.1,7.7)),gfGravN=gfFbm(gfW*.06+vec2(11.3,2.9)),gfScrubN=gfFbm(gfW*.045+vec2(5.5,13.1));
      vec3 gfSand=gfProject(map,gfPosition*.071).rgb;gfSand=mix(vec3(dot(gfSand,vec3(.2126,.7152,.0722))),gfSand,.25)/.31;gfSand=mix(gfSand,vec3(1.0),.55)*vec3(1.22,1.12,.94);
      vec3 gfGravel=gfProject(gfRock,gfPosition*.83).rgb;gfGravel=mix(vec3(dot(gfGravel,vec3(.2126,.7152,.0722))),gfGravel,.15)/.40*vec3(.80,.80,.80);
      float gfSandW=smoothstep(.50,.62,gfSandN)*gfFlat*.9,gfGravW=smoothstep(.55,.66,gfGravN)*gfFlat*(1.0-gfSandW)*.85;
      vec3 gfGround=mix(mix(gfSoil,gfSand,gfSandW),gfGravel,gfGravW);
      vec3 gfScan=mix(gfGround,gfStone,gfRockMix());
      /* far away the scan's speckle is what reads as a grid: fade the fine detail with distance (to the type's own mean), so
         the big variation carries the distance instead */
      float gfFar=smoothstep(18.0,85.0,distance(cameraPosition,gfPosition));
      vec3 gfMean=mix(mix(mix(vec3(1.0),vec3(1.22,1.12,.94)*1.05,gfSandW),vec3(.82),gfGravW),vec3(1.0),gfRockMix());
      gfScan=mix(gfScan,gfMean,gfFar*.75);
      /* (3) macro variation: slow noise over ~60 m and ~18 m, brighter bleached ground vs darker warm earth (no repeats) */
      float gfM1=gfFbm(gfW*.016),gfM2=gfNoise(gfW*.055);
      float gfMacro=.74+.42*gfM1+.12*(gfM2-.5);
      vec3 gfDry=mix(vec3(.90,.95,1.08),vec3(1.10,1.0,.88),smoothstep(.3,.7,gfM1));
      float gfRiverBank=6.0+sin(gfPosition.z*.041)*9.0+cos(gfPosition.z*.018)*4.0;
      float gfBank=(1.0-smoothstep(9.0,22.0,abs(gfPosition.x-gfRiverBank)))*smoothstep(-24.0,-18.0,gfPosition.z);
      float gfScrubW=clamp(smoothstep(.52,.66,gfScrubN)*.75+gfBank*.7,0.0,.9)*gfFlat*(1.0-gfSandW*.7);
      vec3 gfScrub=vec3(.80,.92,.58);
      float gfRiver=6.0+sin(gfPosition.z*.041)*9.0+cos(gfPosition.z*.018)*4.0;
      float gfWet=(1.0-smoothstep(6.8,9.5,abs(gfPosition.x-gfRiver)))*smoothstep(-24.0,-20.0,gfPosition.z)*(1.0-smoothstep(1.1,2.2,gfPosition.y));
      diffuseColor.rgb*=clamp(mix(vec3(1.0),gfScan,.72),vec3(.45),vec3(1.5))*gfMacro*gfDry*mix(vec3(1.0),gfScrub,gfScrubW)*mix(1.0,.73,gfWet);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`float roughnessFactor=roughness*mix(gfProject(roughnessMap,gfPosition*.30).g,gfProject(gfRockRough,gfPosition*.24).g,gfRockMix());roughnessFactor=clamp(roughnessFactor-gfWet*.18,.55,1.0);`);
  };
  material.customProgramCacheKey=()=>`gf-world-surface-${mine?1:0}-3`;return material;
}
