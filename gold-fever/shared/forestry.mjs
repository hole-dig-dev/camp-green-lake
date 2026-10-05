import {FOREST_TREES,heightAt,clamp,distance} from './world.mjs';
export const WOOD={hits:5,logsPerTree:6,capacity:24,supportCost:4,chopMs:650,reach:3.5};
export function ensureForest(r){r.forest??={version:1,trees:{},stacks:[]};r.forest.stacks??=[];for(const p of Object.values(r.players))p.wood??=0;return r.forest;}
export function treeTarget(r,p,yaw=p.yaw,pitch=0){
  if(!Number.isFinite(yaw)||!Number.isFinite(pitch))return null;
  const eye=p.y+1.65,dx=-Math.sin(yaw)*Math.cos(pitch),dy=Math.sin(pitch),dz=-Math.cos(yaw)*Math.cos(pitch),hits=[];
  for(const t of FOREST_TREES){if(r.forest?.trees[t.id]?.felledAt!==undefined)continue;const y=heightAt(t.x,t.z,r.cells),px=t.x-p.x,pz=t.z-p.z,along=(px*dx+pz*dz)/(dx*dx+dz*dz||1),side=Math.hypot(px-dx*along,pz-dz*along),ty=eye+dy*along;if(along<0||along>WOOD.reach||side>.25*t.scale+.22||ty<y||ty>y+2.8*t.scale)continue;hits.push({...t,y,distance:along,hits:r.forest?.trees[t.id]?.hits||0});}
  return hits.sort((a,b)=>a.distance-b.distance)[0]||null;
}
const no=message=>({ok:false,message}),ok=(message,extra={})=>({ok:true,message,...extra});
const mark=r=>{r.dirty=true;r.revision++;};
function free(p){return !p.vehicle&&!p.cart&&!p.mineCart&&!p.hoistRide&&!p.busy&&!p.tumble&&!p.shovel?.mass;}
export function forestryAction(r,p,a,now){
  if(!['chopTree','collectWood','dropWood'].includes(a.type))return null;
  const f=ensureForest(r);if(!free(p))return no('Free your hands and empty your shovel before working with logs.');
  if(a.type==='chopTree'){
    if(now<(p.chopUntil||0))return {ok:false,quiet:true};
    const t=treeTarget(r,p,Number(a.yaw),Number(a.pitch));if(!t||t.id!==a.target)return no('Aim your axe at a nearby standing trunk.');
    const s=f.trees[t.id]??={hits:0};s.hits++;p.chopUntil=now+WOOD.chopMs;
    if(s.hits>=WOOD.hits){s.felledAt=now;s.yaw=Number(a.yaw);s.logs=WOOD.logsPerTree;}
    mark(r);return ok(s.felledAt!==undefined?'TIMBER! Wait for it to fall, then E collects the logs.':'',{effect:{type:s.felledAt!==undefined?'treeFall':'chop',player:p.id,x:t.x,y:t.y+1,z:t.z}});
  }
  if(a.type==='dropWood'){
    const logs=Math.min(6,p.wood);if(!logs)return no('Your pack has no wood to drop.');
    const x=p.x-Math.sin(p.yaw)*.8,z=p.z-Math.cos(p.yaw)*.8;f.stacks.push({id:'logs'+r.nextId++,x,y:p.y,z,logs});p.wood-=logs;mark(r);return ok(`Dropped ${logs} logs. A friend can collect them with E.`);
  }
  const tree=FOREST_TREES.find(t=>t.id===a.target),s=tree?f.trees[tree.id]:f.stacks.find(s=>s.id===a.target),pos=tree?{...tree,y:heightAt(tree.x,tree.z,r.cells)}:s;
  if(!s||!pos||!(s.logs>0)||distance(p,pos)>3.8||Math.abs(p.y-pos.y)>2)return no('Stand beside the fallen logs to collect them.');
  if(tree&&now<s.felledAt+1400)return no('Let the tree finish falling first.');
  const n=Math.min(s.logs,WOOD.capacity-p.wood);if(n<=0)return no('Your wood pack is full (24 logs). Craft supports with B, or drop logs with G while holding the axe.');
  s.logs-=n;p.wood+=n;f.stacks=f.stacks.filter(s=>s.logs>0);mark(r);return ok(`Collected ${n} logs. B crafts a mine support from ${WOOD.supportCost}.`);
}
export function forestPublic(r){const f=ensureForest(r);return {trees:f.trees,stacks:f.stacks};}
