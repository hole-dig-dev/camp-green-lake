/* ============================================================================================================
   14-look.js : THE LOOK. Everything the picture goes through after the 3D scene is drawn.

   The scene used to be drawn straight to the screen: flat, no glow, no depth cues. Now it is drawn into an
   off-screen HDR picture (anti-aliased), and a few cheap full-screen passes turn that into the final image:

     1. ambient occlusion  : soft contact shadows in corners and under things, worked out from the depth picture
                             (half resolution). This is most of what makes low-poly read as "solid".
     2. bloom              : anything brighter than white (sun on pale sand, lamps, gold) bleeds a soft glow.
     3. grade              : exposure, a soft highlight roll-off instead of hard clipping, contrast, saturation,
                             warm highlights / cool shadows, a vignette and a little film grain.

   The game calls lookRender(scene,camera) where it used to call renderer.render(scene,camera) (90-loop.js).
   If anything here can't be set up (WebGL1, no float targets), LOOK.ok stays false and lookRender falls back to
   the plain render, so the game still runs.

   Tuning: LOOK.* below are the live values (the grade ones are changed over the day by 16-sky.js). The console
   command `look off` / `look on` (76-console.js) flips the whole pass for a before/after.
   ============================================================================================================ */
const LOOK={
  ok:false,on:true,
  ao:true,aoRadius:0.55,aoPower:1.15,aoFar:70,   // contact shadows: radius in metres, strength, and the distance they fade out by
  bloom:0.32,bloomThresh:1.2,bloomKnee:0.25,     // glow: how much is added, and how bright a pixel must be before it glows
  exposure:1.0,contrast:1.06,saturation:1.1,     // overall grade
  shoulder:0.72,                                 // highlights start rolling off above this (1 = hard clip like before)
  warm:new T.Color(1.04,1.0,0.94),               // multiplied into the highlights
  cool:new T.Color(0.95,0.99,1.06),              // multiplied into the shadows
  vignette:0.26,grain:0.022,
};
{
  const gl=renderer.getContext(),gl2=renderer.capabilities.isWebGL2;
  const floatOK=gl2&&!!gl.getExtension('EXT_color_buffer_float');
  if(gl2&&floatOK){try{
    const TYPE=T.HalfFloatType;
    const tri=new T.BufferGeometry();   // one big triangle that covers the screen (cheaper than a quad: no diagonal seam)
    tri.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0, 3,-1,0, -1,3,0],3));
    tri.setAttribute('uv',new T.Float32BufferAttribute([0,0, 2,0, 0,2],2));
    const VS='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
    const pCam=new T.OrthographicCamera(-1,1,1,-1,0,1),pScene=new T.Scene(),pMesh=new T.Mesh(tri,null);
    pMesh.frustumCulled=false;pScene.add(pMesh);
    const mat=(fs,u)=>new T.ShaderMaterial({vertexShader:VS,fragmentShader:fs,uniforms:u,depthTest:false,depthWrite:false});
    const pass=(m,target)=>{pMesh.material=m;renderer.setRenderTarget(target);renderer.render(pScene,pCam)};

    /* --- targets (made in resize) --- */
    let W=0,H=0,rtScene=null,rtAO=null,rtB=[];const BLOOM_LEVELS=5;
    const mk=(w,h,type)=>new T.WebGLRenderTarget(Math.max(1,w),Math.max(1,h),{minFilter:T.LinearFilter,magFilter:T.LinearFilter,format:T.RGBAFormat,type:type||TYPE,depthBuffer:false,stencilBuffer:false});
    function resize(w,h){
      W=w;H=h;
      if(rtScene){rtScene.dispose();rtAO.dispose();rtB.forEach(r=>r.dispose())}
      rtScene=new T.WebGLMultisampleRenderTarget(w,h,{minFilter:T.LinearFilter,magFilter:T.LinearFilter,format:T.RGBAFormat,type:TYPE,depthBuffer:true,stencilBuffer:false});
      rtScene.samples=LOW_POWER?2:4;
      rtScene.depthTexture=new T.DepthTexture(w,h);rtScene.depthTexture.type=T.UnsignedIntType;
      rtAO=mk(w>>1,h>>1,T.UnsignedByteType);
      rtB=[];for(let i=0;i<BLOOM_LEVELS;i++)rtB.push(mk(w>>(i+1),h>>(i+1)));
    }

    /* --- 1. ambient occlusion from depth. Normals come from the depth picture's own slopes, which is exact for
           flat-shaded low-poly. 10 samples in a spiral, rotated per pixel so the pattern never lines up. --- */
    const mAO=mat(`
      precision highp float;varying vec2 vUv;uniform sampler2D tDepth;uniform vec2 uPx;uniform float uNear,uFar,uRadius,uPower,uFade;uniform vec2 uProj;
      float lin(float d){float z=d*2.-1.;return 2.*uNear*uFar/(uFar+uNear-z*(uFar-uNear));}
      vec3 vpos(vec2 uv){float z=lin(texture2D(tDepth,uv).x);return vec3((uv*2.-1.)*uProj*z,-z);}
      void main(){
        float d=texture2D(tDepth,vUv).x;if(d>=0.9999){gl_FragColor=vec4(1.);return;}
        vec3 p=vpos(vUv);float z=-p.z;if(z>uFade){gl_FragColor=vec4(1.);return;}
        vec3 px=vpos(vUv+vec2(uPx.x,0.))-p,nx=p-vpos(vUv-vec2(uPx.x,0.)),py=vpos(vUv+vec2(0.,uPx.y))-p,ny=p-vpos(vUv-vec2(0.,uPx.y));
        vec3 dx=abs(px.z)<abs(nx.z)?px:nx,dy=abs(py.z)<abs(ny.z)?py:ny;     // take the side that doesn't cross an edge
        vec3 n=normalize(cross(dx,dy));
        float rot=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))))*6.2831853,occ=0.;
        float rScr=uRadius/z;                                                 // the radius as a fraction of the view's half-height/width at this depth
        for(int i=0;i<10;i++){
          float fi=float(i)+0.5,r=sqrt(fi/10.),a=fi*2.39996323+rot;
          vec2 uv=vUv+vec2(cos(a),sin(a))*r*rScr*0.5/uProj;
          vec3 v=vpos(uv)-p;float l=length(v)+1e-4;
          occ+=max(0.,dot(n,v)/l-0.12)*smoothstep(uRadius*1.6,uRadius*0.4,l);   // above the surface, and not a far-away thing
        }
        float ao=1.-occ/10.*uPower*1.9;ao=mix(ao,1.,smoothstep(uFade*0.55,uFade,z));
        gl_FragColor=vec4(clamp(ao,0.,1.));
      }`,{tDepth:{value:null},uPx:{value:new T.Vector2()},uNear:{value:0.1},uFar:{value:3000},uRadius:{value:0.5},uPower:{value:1},uFade:{value:70},uProj:{value:new T.Vector2()}});

    /* --- 2. bloom: keep what's brighter than the threshold, shrink it 5 times (each a soft 13-tap blur), then add
           the levels back up. Wide, smooth, no visible steps. --- */
    const mBright=mat(`
      precision highp float;varying vec2 vUv;uniform sampler2D tSrc;uniform vec2 uPx;uniform float uThresh,uKnee;
      vec3 s(vec2 o){return min(texture2D(tSrc,vUv+o*uPx).rgb,vec3(12.));}
      void main(){
        vec3 c=(s(vec2(-1.,-1.))+s(vec2(1.,-1.))+s(vec2(-1.,1.))+s(vec2(1.,1.)))*0.25;
        float b=max(c.r,max(c.g,c.b)),k=clamp(b-uThresh+uKnee,0.,2.*uKnee);k=k*k/(4.*uKnee+1e-4);
        gl_FragColor=vec4(c*max(k,b-uThresh)/max(b,1e-4),1.);
      }`,{tSrc:{value:null},uPx:{value:new T.Vector2()},uThresh:{value:0.9},uKnee:{value:0.5}});
    const mDown=mat(`
      precision highp float;varying vec2 vUv;uniform sampler2D tSrc;uniform vec2 uPx;
      vec3 s(float x,float y){return texture2D(tSrc,vUv+vec2(x,y)*uPx).rgb;}
      void main(){
        vec3 a=s(-2.,-2.),b=s(0.,-2.),c=s(2.,-2.),d=s(-2.,0.),e=s(0.,0.),f=s(2.,0.),g=s(-2.,2.),h=s(0.,2.),i=s(2.,2.),j=s(-1.,-1.),k=s(1.,-1.),l=s(-1.,1.),m=s(1.,1.);
        gl_FragColor=vec4(e*0.125+(a+c+g+i)*0.03125+(b+d+f+h)*0.0625+(j+k+l+m)*0.125,1.);
      }`,{tSrc:{value:null},uPx:{value:new T.Vector2()}});

    /* --- 3. the grade. Works in the same "what you see is what was authored" space the game has always drawn in,
           so every existing colour keeps its meaning; it only shapes highlights, contrast and mood. --- */
    const mGrade=mat(`
      precision highp float;varying vec2 vUv;uniform sampler2D tScene,tBloom,tAO;uniform vec2 uPx;uniform float uAO,uBloom,uExp,uCon,uSat,uSh,uVig,uGrain,uT;uniform vec3 uWarm,uCool;
      vec3 roll(vec3 x){vec3 t=max(x-uSh,0.)/(1.-uSh);return min(x,vec3(uSh))+(1.-uSh)*(1.-exp(-t));}   // identity below the shoulder, eases into white above it
      void main(){
        vec3 c=texture2D(tScene,vUv).rgb;
        if(uAO>0.){float a=(texture2D(tAO,vUv+uPx*vec2(1.,1.)).r+texture2D(tAO,vUv+uPx*vec2(-1.,1.)).r+texture2D(tAO,vUv+uPx*vec2(1.,-1.)).r+texture2D(tAO,vUv+uPx*vec2(-1.,-1.)).r)*0.25;
          c*=mix(vec3(1.),vec3(a)*vec3(0.92,0.96,1.04)+vec3(0.06,0.03,0.0)*(1.-a),uAO);}       // occlusion leans a little cool, not grey
        c+=texture2D(tBloom,vUv).rgb*uBloom;
        c*=uExp;
        float l=dot(c,vec3(0.2126,0.7152,0.0722));
        c*=mix(uCool,uWarm,smoothstep(0.08,0.75,l));
        {float m=max(c.r,max(c.g,c.b));vec3 hp=c*(roll(vec3(m)).r/max(m,1e-4));c=mix(roll(c),hp,0.7);}   // mostly keep the hue as it rolls off (sand stays sand-coloured), with a little natural whitening
        c=(c-0.5)*uCon+0.5;
        l=dot(c,vec3(0.2126,0.7152,0.0722));c=mix(vec3(l),c,uSat);
        vec2 q=vUv-0.5;c*=1.-uVig*smoothstep(0.25,0.95,dot(q,q)*2.2);
        float n=fract(sin(dot(gl_FragCoord.xy+uT*61.,vec2(12.9898,78.233)))*43758.5453)-0.5;c+=n*uGrain;
        gl_FragColor=vec4(clamp(c,0.,1.),1.);
      }`,{tScene:{value:null},tBloom:{value:null},tAO:{value:null},uPx:{value:new T.Vector2()},uAO:{value:1},uBloom:{value:0.5},uExp:{value:1},uCon:{value:1},uSat:{value:1},uSh:{value:0.7},uVig:{value:0.2},uGrain:{value:0.02},uT:{value:0},uWarm:{value:LOOK.warm},uCool:{value:LOOK.cool}});

    const sz=new T.Vector2();let t0=performance.now();
    LOOK.render=function(scn,cam){
      renderer.getDrawingBufferSize(sz);const w=sz.x|0,h=sz.y|0;
      if(w!==W||h!==H)resize(w,h);
      const autoClear=renderer.autoClear;
      renderer.setRenderTarget(rtScene);renderer.render(scn,cam);
      /* AO */
      const useAO=LOOK.ao&&!LOW_POWER;
      if(useAO){const u=mAO.uniforms;u.tDepth.value=rtScene.depthTexture;u.uPx.value.set(1/w,1/h);u.uNear.value=cam.near;u.uFar.value=cam.far;
        u.uRadius.value=LOOK.aoRadius;u.uPower.value=LOOK.aoPower;u.uFade.value=LOOK.aoFar;
        const ty=Math.tan(cam.fov*Math.PI/360);u.uProj.value.set(ty*cam.aspect,ty);pass(mAO,rtAO)}
      /* bloom */
      mBright.uniforms.tSrc.value=rtScene.texture;mBright.uniforms.uPx.value.set(1/w,1/h);mBright.uniforms.uThresh.value=LOOK.bloomThresh;mBright.uniforms.uKnee.value=LOOK.bloomKnee;pass(mBright,rtB[0]);
      for(let i=1;i<BLOOM_LEVELS;i++){mDown.uniforms.tSrc.value=rtB[i-1].texture;mDown.uniforms.uPx.value.set(1/rtB[i-1].width,1/rtB[i-1].height);pass(mDown,rtB[i])}
      /* add back up, in place: level i-1 += blurred level i  (rtB[i-1] is both read as tAdd and written, so go through additive blending instead) */
      mUpAdd.uniforms.uPx.value.set(0,0);
      for(let i=BLOOM_LEVELS-1;i>0;i--){mUpAdd.uniforms.tSrc.value=rtB[i].texture;mUpAdd.uniforms.uPx.value.set(1/rtB[i].width,1/rtB[i].height);renderer.autoClear=false;pass(mUpAdd,rtB[i-1]);renderer.autoClear=autoClear}
      /* grade to the screen */
      const g=mGrade.uniforms;g.tScene.value=rtScene.texture;g.tBloom.value=rtB[0].texture;g.tAO.value=rtAO.texture;g.uPx.value.set(1/w,1/h);
      g.uAO.value=useAO?1:0;g.uBloom.value=LOOK.bloom;g.uExp.value=LOOK.exposure;g.uCon.value=LOOK.contrast;g.uSat.value=LOOK.saturation;g.uSh.value=LOOK.shoulder;
      g.uVig.value=LOOK.vignette;g.uGrain.value=LOOK.grain;g.uT.value=((performance.now()-t0)*0.06|0)%997;
      pass(mGrade,null);
    };
    /* the "add the blurred level on top" material: same 9-tap tent as mUp, drawn with additive blending */
    const mUpAdd=new T.ShaderMaterial({vertexShader:VS,fragmentShader:`
      precision highp float;varying vec2 vUv;uniform sampler2D tSrc;uniform vec2 uPx;
      vec3 s(float x,float y){return texture2D(tSrc,vUv+vec2(x,y)*uPx).rgb;}
      void main(){gl_FragColor=vec4((s(-1.,-1.)+s(1.,-1.)+s(-1.,1.)+s(1.,1.))*0.0625+(s(0.,-1.)+s(-1.,0.)+s(1.,0.)+s(0.,1.))*0.125+s(0.,0.)*0.25,1.);}`,
      uniforms:{tSrc:{value:null},uPx:{value:new T.Vector2()}},depthTest:false,depthWrite:false,blending:T.AdditiveBlending,transparent:true});
    LOOK.ok=true;
  }catch(e){console.warn('look pass unavailable:',e&&e.message);LOOK.ok=false}}
}
function lookRender(scn,cam){if(LOOK.ok&&LOOK.on){try{LOOK.render(scn,cam);return}catch(e){console.warn('look pass failed, falling back:',e&&e.message);LOOK.ok=false;renderer.setRenderTarget(null)}}renderer.render(scn,cam)}
