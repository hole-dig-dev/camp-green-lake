// Original treasure-hunt rules. Hidden positions stay on the host until excavated.
import {random,riverX,baseHeight,heightAt,distance} from './world.mjs';
import {inMine,mineDistance,mineFloor,d3} from './mine.mjs';
import {canyonCenter} from './canyon.mjs';
export const RELIC_TYPES={coin:{name:'Lost gold dollar',value:1800,slots:1},watch:{name:'Prospector’s pocket watch',value:6500,slots:1},boot:{name:'Suspiciously fancy boot',value:2400,slots:1},horseshoe:{name:'Lucky silver horseshoe',value:4200,slots:1},motherlode:{name:'THE MOTHERLODE',value:1500000,slots:3}};
export function ensureRelics(r){
 if(r.relics)return r.relics;
 const items=[],make=(type,x,y,z)=>items.push({id:'relic'+items.length,type,x,y,z,state:'buried',owner:null});
 for(let i=0;i<30;i++){const z=-16+random(r.seed,i,0,901)*114,x=riverX(z)+(i%2?1:-1)*(10+random(r.seed,i,0,902)*18);if(inMine(x,z))continue;make(['coin','watch','boot','horseshoe'][i%4],x,baseHeight(x,z)-(.45+random(r.seed,i,0,903)*.65),z);}
 for(let i=0;i<8;i++){const x=-85+random(r.seed,i,0,904)*39,z=-8+random(r.seed,i,0,905)*27,y=3-random(r.seed,i,0,906)*20;make(i%2?'watch':'horseshoe',x,y,z);}
 for(let i=0;i<8;i++){const x=-42+random(r.seed,i,0,907)*84,z=canyonCenter(x)+(random(r.seed,i,0,908)-.5)*10;make(i%2?'coin':'watch',x,baseHeight(x,z)-(.8+random(r.seed,i,0,909)*2.2),z);}
 const x=-24+random(r.seed,0,0,910)*48,z=canyonCenter(x)+(random(r.seed,0,0,911)-.5)*6;
 make('motherlode',x,baseHeight(x,z)-(4+random(r.seed,0,0,912)*3),z);
 r.relics={version:1,items,earned:0};r.dirty=true;return r.relics;
}
const air=(r,x,y,z)=>inMine(x,z)?mineDistance(r.mine,x,y,z):y-heightAt(x,z,r.cells);
export function relicClear(r,t){return air(r,t.x,t.y+.06,t.z)>-.025;}
function sight(r,p,t){const a={x:p.x,y:p.y+1.3,z:p.z},n=Math.ceil(d3(a,t)/.25);for(let i=1;i<n;i++){const f=i/n;if(air(r,a.x+(t.x-a.x)*f,a.y+(t.y-a.y)*f,a.z+(t.z-a.z)*f)<-.035)return false;}return true;}
export function carriedRelics(r,p){return ensureRelics(r).items.filter(t=>t.state==='carried'&&t.owner===p.id);}
export function relicLoad(p){return 1-(p.relics||[]).reduce((n,t)=>n+(t.type==='motherlode'?.30:.04),0);}
export function relicSlow(r,p){return 1-carriedRelics(r,p).reduce((n,t)=>n+(t.type==='motherlode'?.30:.04),0);}
export function tickRelics(r){
 const events=[],data=ensureRelics(r);if(!Object.values(r.players).some(p=>p.active))return events;
 for(const t of data.items){if(t.state==='buried'&&relicClear(r,t)){t.state='exposed';r.dirty=true;r.revision++;events.push({effect:{type:'relicReveal',x:t.x,y:t.y,z:t.z},broadcast:t.type==='motherlode'?'MOTHERLODE EXPOSED! Get it out and take it to Bill.':null});}else if(t.state==='exposed'&&!relicClear(r,t)){t.state='buried';r.dirty=true;r.revision++;}}
 return events;
}
export function relicAction(r,p,a){
 if(a.type!=='relicTake'&&a.type!=='relicDrop')return null;
 const no=message=>({ok:false,message});if(p.vehicle||p.cart||p.mineCart||p.hoistRide||p.busy||p.tumble||p.shovel?.mass||p.shovelPlant)return no('Free your hands and empty the shovel before handling a find.');
 const bag=carriedRelics(r,p);let t;
 if(a.type==='relicTake'){
  t=ensureRelics(r).items.find(t=>t.id===a.target);if(!t||t.state!=='exposed'||!relicClear(r,t))return no('Dig the find out of the ground first.');
  if(d3({...p,y:p.y+.6},t)>3.2||!sight(r,p,t))return no('Move close to the exposed find; rock must be clear between you and it.');
  if(bag.reduce((n,t)=>n+RELIC_TYPES[t.type].slots,0)+RELIC_TYPES[t.type].slots>3)return no('Your find satchel has three slots. Sell or drop your finds first; the Motherlode needs all three.');
  t.state='carried';t.owner=p.id;
 }else{
  t=bag.find(t=>t.id===a.target)||bag.at(-1);if(!t)return no('Your find satchel is empty.');
  t.x=p.x-Math.sin(p.yaw)*.75;t.z=p.z-Math.cos(p.yaw)*.75;t.y=(inMine(t.x,t.z)?mineFloor(r.mine,t.x,t.z,p.y+.7):heightAt(t.x,t.z,r.cells))+.12;t.owner=null;t.state='exposed';
 }
 r.dirty=true;r.revision++;return {ok:true,message:a.type==='relicTake'?`${RELIC_TYPES[t.type].name} secured. Take it to Bill; G with the divining rod drops it for a friend.`:`${RELIC_TYPES[t.type].name} dropped. A friend can collect it with E.`,effect:{type:'relicTake',x:p.x,y:p.y+1,z:p.z}};
}
export function sellRelics(r,p){const data=ensureRelics(r),bag=carriedRelics(r,p);let value=0;for(const t of bag){value+=RELIC_TYPES[t.type].value;t.state='delivered';t.owner=null;}if(value){data.earned+=value;r.dirty=true;r.revision++;}return {value,count:bag.length,motherlode:bag.some(t=>t.type==='motherlode')};}
export function relicSignal(r,p){
 if(p.input?.tool!=='rod'||!p.upgrades.includes('diviningrod')||p.vehicle||p.busy)return null;
 const candidates=ensureRelics(r).items.filter(t=>['buried','exposed'].includes(t.state)),rank=t=>Math.hypot(t.x-p.x,(t.y-p.y)*1.3,t.z-p.z),t=candidates.sort((a,b)=>rank(a)-rank(b))[0];
 if(!t||rank(t)>24)return {strength:0,label:'Quiet',depth:'Walk and sweep the rod to search.'};
 const dx=t.x-p.x,dz=t.z-p.z,d=rank(t),alignment=Math.max(0,(-Math.sin(p.yaw)*dx-Math.cos(p.yaw)*dz)/(Math.hypot(dx,dz)||1)),strength=Math.round((1-d/24)*(.3+.7*alignment)*100)/100;
 return {strength,label:strength>.72?'HOT':strength>.40?'Warm':strength>.15?'Faint':'Quiet',depth:d<6?(t.y<p.y-.6?'Below your boots — dig down.':t.y>p.y+2?'Above you — search the wall.':'Close — clear the dirt around you.'):'Sweep left and right; follow the strongest rattle.'};
}
export function relicPublic(r){return ensureRelics(r).items.filter(t=>t.state==='exposed').map(t=>({...t,...RELIC_TYPES[t.type]}));}
export function relicBagPublic(r,p){return carriedRelics(r,p).map(({id,type})=>({id,type,...RELIC_TYPES[type]}));}
export function relicQuest(r){
 const data=ensureRelics(r),m=data.items.find(t=>t.type==='motherlode'),delivered=data.items.filter(t=>t.state==='delivered'),sector=m.x<-8?'western':m.x>8?'eastern':'central';
 return {completed:m.state==='delivered',found:data.items.filter(t=>t.state!=='buried').length,delivered:delivered.length,total:data.items.length,earned:data.earned,collection:delivered.map(t=>({id:t.id,type:t.type,name:RELIC_TYPES[t.type].name})),rumor:`Bill’s old map mentions the ${sector} canyon floor. The Motherlode lies 4–7m beneath its dirt. Sweep a divining rod there, then dig a ramp down; bring supports.`,motherlode:m.state==='delivered'?'Claimed':m.state==='carried'?'On the way to Bill':m.state==='exposed'?'Exposed':'Still buried'};
}
