'use strict';
/* public/js/81-badges.js -- badges and jumpsuits, after Greg's branch (claude/intense-change-1-test-2026-09-27-1829),
   adapted to what this game tracks (no sentences or curse here yet), plus a few for the rope, the wheelbarrow and
   carrying friends home. Both live in this browser (localStorage 'cgl-meta'), across runs.
   Pause menu > Badges shows them and lets you pick a jumpsuit; friends see your jumpsuit colour.
   Also here: the shop's supplies that need their own logic (onion tonic, first-aid kit) and Q's "use the right thing". */
const BADGES={
  caveman:['Caveman','Finish 25 holes'],
  ladder:['Human ladder','Help a friend up 10 times (pull them out, pick them up, carry them home)'],
  pallbearer:['Pallbearer','Carry a downed friend back inside the fence'],
  sploosh:['Sploosh','Eat 5 jars of Sploosh or peaches'],
  onion:['Onion breath','Eat 10 onions'],
  magnet:['Sticky Fingers','Pick up 3 dropped sacks'],
  squid:['Punching Bag','Get knocked out 5 times'],
  barfbag:['Barf Bag','Twerk 20 times'],
  lullaby:['If only, if only','Sing 40 lines of the lullaby'],
  squasher:['Snake charmer','Squash 15 hatchlings, rattlesnakes or scorpions'],
  hauler:['Hauler','Sell 3 pieces of heavy loot'],
  knots:['Knots','Tie your rope to something 10 times'],
  butter:['Butterfingers','Knock 50 gold off heavy loot by dropping it'],
  stanley:['Stanley','Dig up the suitcase'],
  clyde:['Sweet Feet','Get hit by falling sneakers'],
};
const JUMPSUITS=[
  {n:'Orange (standard issue)',c:0xe8742a,ok:()=>true},
  {n:'Faded blue (the crew reaches day 3)',c:0x4f7fa8,ok:()=>(META.bestDay||1)>=3},
  {n:'Midnight black (the crew reaches day 5)',c:0x2a2a2a,ok:()=>(META.bestDay||1)>=5},
  {n:'Onion green (earn 6 badges)',c:0x6f9a3a,ok:()=>Object.keys(META.badges||{}).length>=6},
  {n:'Sploosh peach (earn 10 badges)',c:0xf0a070,ok:()=>Object.keys(META.badges||{}).length>=10},
  {n:'Gold (dig up the suitcase)',c:0xd4af37,ok:()=>!!(META.badges||{}).stanley},
];
let META={};
try{META=JSON.parse(localStorage.getItem('cgl-meta')||'{}')||{}}catch(e){META={}}
function saveMeta(){try{localStorage.setItem('cgl-meta',JSON.stringify(META))}catch(e){}}
function badge(id){
  META.badges=META.badges||{};if(META.badges[id]||!BADGES[id])return;
  META.badges[id]=Date.now();saveMeta();toast(`BADGE: ${BADGES[id][0]}. ${BADGES[id][1]}.`,'gold',5500);sfx.gold();logEv('badge',{id});
  const n=Object.keys(META.badges).length;for(const s of JUMPSUITS)if(!s.told&&s.ok()&&s!==JUMPSUITS[0]){s.told=true;if(n>1)toast(`New jumpsuit unlocked: ${s.n.split(' (')[0]}. Pick it in the pause menu (Esc) > Badges.`,'gold',6000)}
}
function countUp(k,goal,id,by){META.cnt=META.cnt||{};META.cnt[k]=(META.cnt[k]||0)+(by||1);saveMeta();if(META.cnt[k]>=goal)badge(id)}
function noteDay(d){if(d>(META.bestDay||1)){META.bestDay=d;saveMeta()}}
function mySuit(){let i=0;try{i=num(localStorage.getItem('cgl-suit'),0,JUMPSUITS.length-1,0)|0}catch(e){}return JUMPSUITS[i].ok()?i:0}
/* recolour a camper's jumpsuit (the Blender camper's CGL_Jumpsuit material, or the box person's suit) */
function paintSuit(p,i){
  const c=(JUMPSUITS[i]||JUMPSUITS[0]).c;if(!p)return;p.suitIdx=i;
  p.g.traverse(o=>{if(!o.isMesh||!o.material)return;const m=o.material;if(m.name==='CGL_Jumpsuit'||(o.userData&&o.userData.suit)){if(!o.userData.suitOwn){o.material=m.clone();o.userData.suitOwn=true}o.material.color.setHex(c)}});
}
function setSuit(i){
  if(!JUMPSUITS[i]||!JUMPSUITS[i].ok())return;
  try{localStorage.setItem('cgl-suit',String(i))}catch(e){}
  paintSuit(me,i);wsSend({t:'suit',u:i});renderBadges();
}

/* ---- the pause-menu screen ---- */
function renderBadges(){
  const box=$('#badgeList');if(!box)return;box.textContent='';
  const got=META.badges||{},n=Object.keys(got).length;
  $('#badgeCount').textContent=`${n} of ${Object.keys(BADGES).length} earned`;
  for(const id in BADGES){const d=document.createElement('div');d.className='badge-row'+(got[id]?' got':'');
    const b=document.createElement('b');b.textContent=(got[id]?'★ ':'☆ ')+BADGES[id][0];const s=document.createElement('span');s.textContent=BADGES[id][1];d.append(b,s);box.appendChild(d)}
  const sb=$('#suitList');sb.textContent='';const cur=mySuit();
  JUMPSUITS.forEach((s,i)=>{const bt=document.createElement('button');bt.type='button';bt.className='suit-btn'+(i===cur?' on':'');bt.disabled=!s.ok();
    const sw=document.createElement('i');sw.style.background='#'+s.c.toString(16).padStart(6,'0');const t=document.createElement('span');t.textContent=s.ok()?s.n.split(' (')[0]:'🔒 '+s.n;
    bt.append(sw,t);bt.onclick=()=>setSuit(i);sb.appendChild(bt)});
}

/* ---- supplies: onion tonic and the first-aid kit (Supply Depot), and Q ---- */
function useSupply(){
  if(S.ko)return;
  if(S.medkit>0&&AFF.injury>10){S.medkit--;AFF.injury=0;syncHp();sfx.find();showSupply('medkit');toast('You patch yourself up with the first-aid kit.','good',2500);logEv('medkit',{self:true});return}
  if(S.tonic>0&&(AFF.poison>3||AFF.burn>5||AFF.heat>5)){S.tonic--;showSupply('tonic');AFF.poison=0;AFF.burn=Math.max(0,AFF.burn-25);AFF.heat=Math.max(0,AFF.heat-20);syncHp();S.onionT=Math.max(S.onionT,30);
    tone(330,0.3,'triangle',0.1,220);toast('You drink some of Sam\'s onion tonic. The sting fades, and lizards won\'t like your smell for 30 seconds.','good',4000);logEv('tonic',{});return}
  eatOnion();
}
