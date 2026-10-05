import * as THREE from '/vendor/three.module.js';
import {surface,part,softBox,ellipsoid as ell,tube,pipe,mergeStaticParts} from './model-parts.mjs';

const outfits=['#507d86','#ba6653','#73914f','#a48b51','#837496','#4d9790','#b38555','#667fb8'];
const skin=surface('#d5a176',{roughness:.75}),rose=surface('#bc7967'),white=surface('#fffbeb'),dark=surface('#242321'),denim=surface('#344c87'),leather=surface('#49362b'),brass=surface('#d8b466',{metalness:.4,roughness:.42});
let brimGeometry;
function hatBrim(){
  if(brimGeometry)return brimGeometry;
  // Elliptical cowboy brim with raised sides and a drooping front/back.
  const p=[],uv=[],index=[],N=48;
  for(let side=0;side<2;side++)for(let radius=0;radius<2;radius++)for(let i=0;i<=N;i++){
    const a=i/N*Math.PI*2,r=radius?.77:.34,x=Math.cos(a)*r,z=Math.sin(a)*r*.80;
    p.push(x,.13*Math.cos(a)**4*(radius?1:0)-.045*Math.sin(a)**2*(radius?1:0)+(side?.025:-.025),z);uv.push(i/N,radius);
  }
  const row=N+1;
  for(let i=0;i<N;i++){
    index.push(i,i+row,i+1,i+1,i+row,i+row+1);
    const b=2*row;index.push(b+i,b+i+1,b+i+row,b+i+1,b+i+row+1,b+i+row);
    for(const r of [0,1]){const a=r*row+i,c=a+2*row;index.push(a,a+1,c,a+1,c+1,c);}
  }
  brimGeometry=new THREE.BufferGeometry();brimGeometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));brimGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));brimGeometry.setIndex(index);brimGeometry.computeVertexNormals();return brimGeometry;
}
export function minerBody({color=0,guard=false}={}){
  const root=new THREE.Group(),hips=new THREE.Group(),body=new THREE.Group(),head=new THREE.Group(),legs=[],arms=[];
  const shirt=surface(guard?'#af3541':outfits[color%outfits.length]),pants=guard?denim:surface('#414b5b'),beard=surface(guard?'#e3ddc9':'#543b2b'),hat=surface(guard?'#50362b':'#8b673b');
  root.add(hips);hips.position.y=guard?1.04:.87;hips.add(body);body.add(head);head.position.y=guard?.94:.96;
  if(!guard){head.scale.set(.83,.85,.83);}
  const width=guard?.63:.39;
  ell(hips,pants,0,-.02,0,width,guard?.45:.20,guard?.46:.28);
  ell(body,shirt,0,.39,0,guard?.54:.37,guard?.49:.42,guard?.37:.26);
  if(guard){ell(body,denim,0,.20,-.06,.62,.42,.43);softBox(body,.53,.43,.085,denim,0,.54,-.365,.035);}
  else{softBox(body,.65,.11,.46,leather,0,.02,0,.025);softBox(body,.14,.095,.035,brass,0,.02,-.25,.018);}
  for(const side of[-1,1]){
    const x=side*(guard?.30:.22);
    const strap=softBox(body,.085,guard?.52:.62,.05,guard?denim:leather,x,.49,guard?-.34:-.255,.018);strap.rotation.z=-side*.09;
    ell(body,brass,x,.39,guard?-.40:-.29,.045,.048,.022);
    const leg=new THREE.Group();leg.position.set(side*(guard?.31:.19),guard?-.38:-.02,0);hips.add(leg);
    ell(leg,pants,0,guard?-.18:-.30,0,guard?.235:.145,guard?.29:.36,guard?.25:.16);
    softBox(leg,guard?.47:.29,.20,guard?.61:.44,leather,0,guard?-.49:-.73,-.075,.085);
    softBox(leg,guard?.48:.30,.045,guard?.63:.46,dark,0,guard?-.57:-.83,-.08,.019);
    // Folded trouser cuffs, boot tops and raised seams survive at conversational distance.
    const cuff=tube(leg,guard?.235:.146,guard?.235:.146,.10,pants,0,guard?-.36:-.57,0);cuff.scale.z=.88;
    pipe(leg,[[.12,-.05,-.04],[.14,-.25,-.08],[.12,guard?-.36:-.55,-.08]],.008,beard);
    legs.push(leg);
    const arm=new THREE.Group();arm.position.set(side*(guard?.56:.41),guard?.62:.65,0);body.add(arm);
    ell(arm,shirt,0,-.16,0,guard?.18:.14,guard?.30:.23,guard?.19:.15);
    ell(arm,skin,0,guard?-.48:-.38,-.015,guard?.145:.115,guard?.19:.14,guard?.15:.115);
    ell(arm,skin,-side*.085,guard?-.46:-.38,-.07,.048,.075,.065);arms.push(arm);
  }
  ell(head,skin,0,0,0,guard?.43:.40,guard?.45:.39,.35);
  ell(head,rose,0,-.025,-.42,guard?.17:.16,.115,.135);
  for(const side of[-1,1]){
    ell(head,skin,side*(guard?.40:.38),-.015,0,.09,.14,.095);
    ell(head,rose,side*(guard?.44:.42),-.01,-.025,.025,.08,.048);
    ell(head,rose,side*.27,-.11,-.29,.095,.06,.042);
    ell(head,white,side*.155,.105,-.32,.122,.133,.078);
    ell(head,dark,side*.15,.10,-.393,.050,.067,.026);
    ell(head,white,side*.15-.013,.124,-.417,.014,.019,.008);
    const brow=ell(head,beard,side*.16,.264,-.315,.16,.034,.045);brow.rotation.z=side*(guard?.30:-.12);
    const mustache=ell(head,beard,side*.13,-.175,-.395,.20,.070,.080);mustache.rotation.z=-side*.30;
  }
  ell(head,dark,0,-.245,-.331,.08,.032,.025);
  if(guard){ell(head,beard,0,-.31,-.15,.41,.31,.30);for(const side of[-1,1])ell(head,beard,side*.20,-.27,-.30,.20,.23,.15);}
  else ell(head,skin,0,-.29,-.13,.26,.105,.22);
  const hatRoot=new THREE.Group();hatRoot.position.y=guard?.43:.37;hatRoot.rotation.z=(guard?-.065:(color%2?.10:-.10));head.add(hatRoot);
  part(hatRoot,hatBrim(),hat);
  const crown=softBox(hatRoot,.71,.34,.62,hat,0,.17,.025,.15);crown.scale.x=guard?1.1:1;
  const band=tube(hatRoot,.365,.38,.075,leather,0,.075,.02);band.scale.z=.86;
  ell(hatRoot,brass,.19,.075,-.285,.047,.041,.020);
  const scarf=surface(guard?'#d2aa53':'#bd5139');ell(body,scarf,0,.78,-.17,.23,.066,.15);
  for(const side of[-1,1]){const tail=softBox(body,.08,.22,.035,scarf,side*.065,.64,-.285,.014);tail.rotation.z=side*.30;}
  // Shirt placket, collars, chest pocket, stitched leather brim and worn knees.
  softBox(body,.045,.48,.025,shirt,0,.35,-.273,.01);
  for(const y of[.18,.32,.46,.60])ell(body,brass,0,y,-.298,.018,.018,.012);
  for(const side of[-1,1]){const collar=softBox(body,.14,.18,.035,shirt,side*.12,.75,-.255,.025);collar.rotation.z=side*.5;}
  softBox(body,.13,.14,.035,shirt,.11,.43,-.274,.015);
  const stitch=surface('#ba9a70');
  pipe(hatRoot,Array.from({length:49},(_,i)=>{const a=i/48*Math.PI*2,r=.70;return [Math.cos(a)*r,.13*Math.cos(a)**4-.045*Math.sin(a)**2+.032,Math.sin(a)*r*.80];}),.008,stitch);
  if(!guard){for(const side of[-1,1]){const patch=softBox(legs[side<0?0:1],.15,.16,.027,surface('#525d68'),0,-.41,-.151,.03);patch.rotation.z=side*.07;}}
  mergeStaticParts(root);root.userData={hips,body,head,legs,arms};return root;
}
