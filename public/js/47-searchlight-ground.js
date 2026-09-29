'use strict';
/* public/js/47-searchlight-ground.js -- the watchtower searchlights light up the ground where they land.
   The terrain shader gets the four beams (SL_U, kept up to date by updateWatchtowers in 22-security.js) and adds a
   warm glow wherever a terrain fragment sits inside a beam's cone: the same cone SIM.towerLit uses to spot you.
   It chains onto 46-holes.js's terrain hook (which cuts the holes out) rather than replacing it, so it loads after it. */
{
  const prev=chunkMat.onBeforeCompile;
  chunkMat.onBeforeCompile=(sh,r)=>{
    if(prev)prev(sh,r);
    Object.assign(sh.uniforms,SL_U);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSLW;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvSLW=(modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vSLW;uniform vec3 uSLPos[4];uniform vec3 uSLDir[4];uniform float uSLCos;uniform float uSLGain;')
      .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        if(uSLGain>0.0){
          float sl=0.0;
          for(int i=0;i<4;i++){
            vec3 v=vSLW-uSLPos[i];float d=length(v);
            // soft edge over the outer quarter of the cone; gentle fall-off with distance so the far tip still reads
            sl+=smoothstep(uSLCos,mix(uSLCos,1.0,0.25),dot(v/d,uSLDir[i]))/(1.0+d*d*0.00008);
          }
          totalEmissiveRadiance+=vec3(1.0,0.9,0.66)*uSLGain*min(sl,1.5);
        }`);
  };
}
