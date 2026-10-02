'use strict';
/* public/js/47-searchlight-glow.js -- the watchtower searchlights light up whatever they land on: the ground, and the
   buildings, props and people standing in a beam. Every MeshStandardMaterial (all the game's lit materials) gets the
   four beams (SL_U, kept up to date by updateWatchtowers in 22-security.js) and adds a warm glow wherever a fragment
   sits inside a beam's cone: the same cone SIM.towerLit uses to spot you. Walls and people are lit by how squarely
   they face the lamp; the ground is lit evenly, so the far end of a beam still reads. There are no shadows: a beam
   lights both a shed and whatever is behind it.
   The terrain and a few effects (twisters, haboob, hole liners) set their own shader hooks; the terrain chains this
   one onto 46-holes.js's (so this file loads after it), the effects go without. */
const SL_TINT='vec3(1.0,0.9,0.66)';   // warm lamp colour
/* a fifth lamp, the UFO's green tractor beam (88-ufo.js sets it while the beam's on; day or night) */
const UFO_U={uUFOPos:{value:new T.Vector3()},uUFODir:{value:new T.Vector3(0,-1,0)},uUFOCos:{value:0.97},uUFOGain:{value:0}};
function slPatch(sh,facing){
  Object.assign(sh.uniforms,SL_U,UFO_U);
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSLW;')
    .replace('#include <project_vertex>',`#include <project_vertex>
      vec4 slw=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        slw=instanceMatrix*slw;
      #endif
      vSLW=(modelMatrix*slw).xyz;`);
  // facing: the view-space normal from normal_fragment_begin, turned into world space, against the way to the lamp
  const face=facing?'*(0.25+0.75*max(dot(inverseTransformDirection(normal,viewMatrix),-v/d),0.0))':'';
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vSLW;uniform vec3 uSLPos[4];uniform vec3 uSLDir[4];uniform float uSLCos;uniform float uSLGain;uniform vec3 uUFOPos;uniform vec3 uUFODir;uniform float uUFOCos;uniform float uUFOGain;')
    .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      if(uSLGain>0.0){
        float sl=0.0;
        for(int i=0;i<4;i++){
          vec3 v=vSLW-uSLPos[i];float d=max(length(v),0.01);
          // soft edge over the outer quarter of the cone; gentle fall-off with distance so the far tip still reads
          sl+=smoothstep(uSLCos,mix(uSLCos,1.0,0.25),dot(v/d,uSLDir[i]))/(1.0+d*d*0.00008)${face};
        }
        totalEmissiveRadiance+=${SL_TINT}*uSLGain*min(sl,1.5)*diffuseColor.rgb*1.6;
      }
      if(uUFOGain>0.0){
        vec3 v=vSLW-uUFOPos;float d=max(length(v),0.01);
        float ub=smoothstep(uUFOCos,mix(uUFOCos,1.0,0.3),dot(v/d,uUFODir))${face};
        totalEmissiveRadiance+=vec3(0.5,1.0,0.38)*uUFOGain*ub*diffuseColor.rgb*1.5;
      }`);
}
// Material.prototype.onBeforeCompile is a no-op, and customProgramCacheKey is this function's text, so every
// standard material shares the patched programs. A material that sets its own hook replaces this one.
T.MeshStandardMaterial.prototype.onBeforeCompile=function(sh){slPatch(sh,true)};
{
  const prev=chunkMat.onBeforeCompile;
  const own=prev!==T.MeshStandardMaterial.prototype.onBeforeCompile;   // 46-holes.js's hook, not the one above
  chunkMat.onBeforeCompile=(sh,r)=>{if(own)prev(sh,r);slPatch(sh,false)};
}
