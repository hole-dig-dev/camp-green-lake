// Shared world geometry. The canyon is a diggable volume, not a decorative mesh.
export const CANYON={minX:-104,maxX:104,minZ:-104,maxZ:-24,minY:-64,top:12,rim:9,depth:38};
export const inCanyon=(x,z)=>x>=CANYON.minX&&x<CANYON.maxX&&z>=CANYON.minZ&&z<CANYON.maxZ;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
export const canyonCenter=x=>-66+Math.sin(x*.035)*5;
export function canyonHeight(x,z){
  const depth=CANYON.depth*clamp((104-Math.abs(x))/76,0,1),d=Math.abs(z-canyonCenter(x));
  return CANYON.rim-depth*(1-smooth(10,21,d))+.08*Math.sin(x*.3)*Math.sin(z*.25);
}
export function canyonBlend(x,z){return (1-smooth(96,104,Math.abs(x)))*(1-smooth(-32,-24,z)) * smooth(-104,-96,z);}
export const CANYON_BRIDGE={x:28,z:canyonCenter(28),halfWidth:1.25,halfLength:22,y:9.15};
export function onCanyonBridge(x,z,pad=0){const b=CANYON_BRIDGE;return Math.abs(x-b.x)<b.halfWidth+pad&&Math.abs(z-b.z)<b.halfLength+pad;}
export const CANYON_ROUTE=[{x:-101,z:-32},{x:-101,z:canyonCenter(-101)},{x:-90,z:canyonCenter(-90)},{x:-75,z:canyonCenter(-75)},{x:-60,z:canyonCenter(-60)},{x:-45,z:canyonCenter(-45)},{x:-28,z:canyonCenter(-28)}];
