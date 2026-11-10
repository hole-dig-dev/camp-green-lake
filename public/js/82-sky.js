/* ============================================================================================================
   82-sky.js : the sky and the light over the day.

   Before: one fixed sun direction, one sun colour, a two-colour sky dome. 18:40 looked the same as noon.
   Now the camp clock drives all of it:
     - the sun crosses the sky (rises in the east at 06:00, sets in the west at 20:00), so shadows turn and
       stretch through the day;
     - sun colour, sky-light colour, fog colour and the grade (14-look.js) follow a short list of keyframes
       (SKY_KEYS): pink dawn, clear morning, white-hot noon, gold late afternoon, orange sunset, violet dusk;
     - the sky dome is a small shader: zenith-to-horizon gradient, a glow around the sun, and flat-bottomed
       drifting clouds lit by the sun.
   Night, the disco, haboobs and the buried town still own their own looks: they keep tinting `sky.material.color`,
   `scene.fog`, `sun.intensity` and `hemi.intensity` exactly as before. This file only sets the things they don't
   (sun.color, hemi colours, SUN_DIR, FOG_DAY, the sky shader's colours).
   Loads after 82-patrol.js (the clock). updateSky(dt) is called from the main loop before updateHaboob.
   ============================================================================================================ */
/* hour, zenith, horizon, sun colour (4th number = brightness), sky light, ground bounce, fog, exposure, saturation, warm tint, hk = sky-light boost */
const SKY_KEYS=[
  {h:6.0, zen:0x5f79b8,hor:0xf7b28c,sun:[1.00,0.55,0.34,0.55],hs:0xd6c4dc,hg:0xb07c58,fog:0xeebfa2,ex:0.98,sat:1.12,warm:[1.07,1.0,0.90],hk:1.35},
  {h:7.6, zen:0x5b95d6,hor:0xf4dcc0,sun:[1.00,0.86,0.68,0.92],hs:0xd2e0ee,hg:0xc08a54,fog:0xecd6b6,ex:1.00,sat:1.10,warm:[1.04,1.0,0.94],hk:1.08},
  {h:12.5,zen:0x3f8ae0,hor:0xecdcc0,sun:[1.00,0.96,0.86,1.06],hs:0xcfe2f2,hg:0xc28a52,fog:0xe8d6b4,ex:1.00,sat:1.10,warm:[1.03,1.0,0.95],hk:1.0},
  {h:16.5,zen:0x4c86d2,hor:0xf2d2a2,sun:[1.00,0.88,0.68,1.04],hs:0xd4dcea,hg:0xc48a50,fog:0xecd0a6,ex:1.00,sat:1.12,warm:[1.05,1.0,0.92],hk:1.05},
  {h:18.6,zen:0x5a6cb6,hor:0xffa25c,sun:[1.00,0.60,0.30,0.98],hs:0xd8bfd0,hg:0xc47a48,fog:0xf2ac78,ex:1.02,sat:1.16,warm:[1.09,1.0,0.86],hk:1.3},
  {h:19.6,zen:0x33376e,hor:0xe2664a,sun:[1.00,0.40,0.24,0.55],hs:0xa58fc0,hg:0x8a5a4a,fog:0xc67a62,ex:1.02,sat:1.14,warm:[1.08,0.98,0.90],hk:1.6},
  {h:20.0,zen:0x1c2050,hor:0x8a4460,sun:[0.55,0.66,1.00,6.00],hs:0x6f88dc,hg:0x34466e,fog:0x5a4a70,ex:1.04,sat:1.06,warm:[1.0,1.0,1.04],hk:3.2},
];
const SKY={zen:new T.Color(),hor:new T.Color(),sun:new T.Color(),hs:new T.Color(),hg:new T.Color(),fog:new T.Color(),a:new T.Color(),b:new T.Color(),
  lastH:-1,cloud:0.5,cloudT:Math.random()*100};
const skyMix=(out,ka,kb,key,f)=>{SKY.a.setHex(ka[key]);SKY.b.setHex(kb[key]);out.copy(SKY.a).lerp(SKY.b,f)};

sky.material=(()=>{
  const m=new T.ShaderMaterial({side:T.BackSide,fog:false,depthWrite:false,
    uniforms:{uZen:{value:SKY.zen},uHor:{value:SKY.hor},uSun:{value:SKY.sun},uDir:{value:SUN_DIR},uTint:{value:new T.Color(1,1,1)},uT:{value:0},uCloud:{value:0.5},uNight:{value:0}},
    vertexShader:'varying vec3 vD;void main(){vD=position;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;}',
    fragmentShader:`
      precision highp float;varying vec3 vD;uniform vec3 uZen,uHor,uSun,uDir,uTint;uniform float uT,uCloud,uNight;
      float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){return vn(p)*0.55+vn(p*2.03+7.1)*0.28+vn(p*4.1+3.3)*0.17;}
      void main(){
        vec3 d=normalize(vD);float y=d.y;
        vec3 c=mix(uHor,uZen,pow(clamp(y*1.25+0.02,0.,1.),0.55));
        if(y<0.)c=mix(uHor,uHor*0.82,clamp(-y*6.,0.,1.));
        float sd=max(dot(d,normalize(uDir)),0.);
        c+=uSun*(pow(sd,6.)*0.22+pow(sd,40.)*0.35)*(1.-uNight);                 // the wide glow and the hot core around the sun
        /* clouds: a flat layer overhead. Puffy tops from layered noise, a hard-ish edge so they read as shapes. */
        if(y>0.015){
          vec2 uv=d.xz/(y+0.22)*0.95+vec2(uT*0.006,uT*0.0025);
          float n=fbm(uv),cov=smoothstep(0.60-uCloud*0.22,0.635-uCloud*0.22,n);
          float top=smoothstep(0.50,0.80,fbm(uv+normalize(uDir).xz*0.14));top=floor(top*3.+0.5)/3.;   // lit side: the noise sampled a step toward the sun, in 3 flat tones to match the low-poly world
          vec3 lit=mix(vec3(1.),uSun,0.55)*1.04,shade=mix(uZen,uHor,0.55)*0.92;
          vec3 cc=mix(shade,lit,top);cc+=uSun*pow(sd,10.)*0.25;
          c=mix(c,cc,cov*smoothstep(0.015,0.16,y)*0.92);
        }
        gl_FragColor=vec4(c*uTint,1.);
      }`});
  m.color=m.uniforms.uTint.value;   // the day-night / disco / haboob code multiplies the sky through sky.material.color: keep that working
  return m;
})();
sunDisc.material.color.setRGB(3.2,2.9,2.3);   // brighter than white on purpose: the bloom turns it into a glowing sun

/* Dust in the air: a few hundred soft motes drifting on the wind in a box around the camera. They catch the sun's
   colour, so they glow gold at dusk and vanish at night. Purely for depth: one draw call, no gameplay meaning. */
const DUST={n:LOW_POWER?140:380,box:26,pts:null,vel:null};
{
  const g=new T.BufferGeometry(),p=new Float32Array(DUST.n*3);DUST.vel=new Float32Array(DUST.n*3);
  for(let i=0;i<DUST.n;i++){p[i*3]=(Math.random()-0.5)*DUST.box;p[i*3+1]=Math.random()*7;p[i*3+2]=(Math.random()-0.5)*DUST.box;
    DUST.vel[i*3]=0.5+Math.random()*0.9;DUST.vel[i*3+1]=(Math.random()-0.5)*0.12;DUST.vel[i*3+2]=(Math.random()-0.5)*0.4}
  g.setAttribute('position',new T.BufferAttribute(p,3));
  const cv=document.createElement('canvas');cv.width=cv.height=32;const c2=cv.getContext('2d'),gr=c2.createRadialGradient(16,16,0,16,16,16);
  gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(0.4,'rgba(255,255,255,0.35)');gr.addColorStop(1,'rgba(255,255,255,0)');c2.fillStyle=gr;c2.fillRect(0,0,32,32);
  DUST.pts=new T.Points(g,new T.PointsMaterial({map:new T.CanvasTexture(cv),size:0.06,sizeAttenuation:true,transparent:true,opacity:0.4,depthWrite:false,fog:true,blending:T.AdditiveBlending}));
  DUST.pts.frustumCulled=false;scene.add(DUST.pts);
}
function updateDust(dt){
  const P3=DUST.pts.geometry.attributes.position,a=P3.array,h=DUST.box/2,cx=camera.position.x,cy=camera.position.y,cz=camera.position.z;
  DUST.pts.visible=cy>-2;if(!DUST.pts.visible)return;                       // not inside a tent (those are rooms under the ground)
  for(let i=0;i<DUST.n;i++){const k=i*3;
    a[k]+=DUST.vel[k]*dt;a[k+1]+=(DUST.vel[k+1]+Math.sin(SKY.cloudT*0.7+i)*0.05)*dt;a[k+2]+=DUST.vel[k+2]*dt;
    if(a[k]-cx>h)a[k]-=DUST.box;else if(a[k]-cx<-h)a[k]+=DUST.box;          // wrap around the camera so the box follows you
    if(a[k+2]-cz>h)a[k+2]-=DUST.box;else if(a[k+2]-cz<-h)a[k+2]+=DUST.box;
    if(a[k+1]-cy>4.5)a[k+1]-=7;else if(a[k+1]-cy<-2.5)a[k+1]+=7}
  P3.needsUpdate=true;
  DUST.pts.material.color.copy(SKY.sun).multiplyScalar(1.5);DUST.pts.material.opacity=0.4*(1-nightF());
}
const SUN_UP=62*Math.PI/180,SUN_MIN=15*Math.PI/180;   // how high the noon sun gets, and how low it's allowed to go (long shadows, but not endless ones)
function updateSky(dt){
  SKY.cloudT+=dt;sky.material.uniforms.uT.value=SKY.cloudT;updateDust(dt);
  const t=clockT(),h=hourOf(t),day=t<DAYMS,hd=day?h:20;
  if(Math.abs(h-SKY.lastH)<0.004)return;SKY.lastH=h;   // colours only need re-mixing when the clock has visibly moved
  let i=0;while(i<SKY_KEYS.length-2&&hd>=SKY_KEYS[i+1].h)i++;
  const A=SKY_KEYS[i],B=SKY_KEYS[i+1];let f=clamp((hd-A.h)/(B.h-A.h),0,1);f=f*f*(3-2*f);
  skyMix(SKY.zen,A,B,'zen',f);skyMix(SKY.hor,A,B,'hor',f);skyMix(SKY.hs,A,B,'hs',f);skyMix(SKY.hg,A,B,'hg',f);skyMix(SKY.fog,A,B,'fog',f);
  const s=A.sun.map((v,k)=>lerp(v,B.sun[k],f));SKY.sun.setRGB(s[0],s[1],s[2]);
  sun.color.setRGB(s[0]*s[3],s[1]*s[3],s[2]*s[3]);const hk=lerp(A.hk,B.hk,f);hemi.color.copy(SKY.hs).multiplyScalar(hk);hemi.groundColor.copy(SKY.hg).multiplyScalar(hk);   // hk: extra sky light when the sun is low or gone, so dawn, dusk and moonlit nights stay readable
  FOG_DAY.copy(SKY.fog);                                // 80-ui.js lerps scene.fog toward FOG_DAY by day
  /* the sun's path: east (+x) to west (-x), leaning toward +z (behind camp, so the lake is front-lit from the gate).
     At night it becomes the moon: high, from the other side. */
  if(day){const u=clamp((h-6)/14,0,1),el=Math.max(SUN_MIN,Math.sin(u*Math.PI)*SUN_UP),az=Math.PI*u;
    SUN_DIR.set(Math.cos(az)*Math.cos(el),Math.sin(el),Math.sin(az)*0.45*Math.cos(el)+0.22).normalize()}
  else SUN_DIR.set(-0.35,0.8,-0.45).normalize();
  sunDisc.position.copy(SUN_DIR).multiplyScalar(800);
  sky.material.uniforms.uNight.value=nightF();
  if(typeof LOOK!=='undefined'){LOOK.exposure=lerp(A.ex,B.ex,f);LOOK.saturation=lerp(A.sat,B.sat,f);
    LOOK.warm.setRGB(lerp(A.warm[0],B.warm[0],f),lerp(A.warm[1],B.warm[1],f),lerp(A.warm[2],B.warm[2],f))}
}
