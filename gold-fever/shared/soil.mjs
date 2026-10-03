// Engine-neutral physical dirt. Each clod carries a conserved parcel of paydirt.
import {inMine,mineSolid,mineFloor,groundAt,digMine,d3} from './mine.mjs';
import { distance, heightAt, clamp, canWalk } from './world.mjs';
import { emptyCargo, addCargo, takeCargo } from './cargo.mjs';

const good = (message = '', extra = {}) => ({ ok: true, message, ...extra });
const fail = message => ({ ok: false, message });
const mark = room => { room.dirty = true; room.revision++; };
export const bucketCapacity = (p, rules) => p.upgrades.includes('bucket') ? 64 : rules.player.bucketKg;
export function ensureSoil(room) { room.clods ??= []; }
export function catchingBucket(p) { return !!p.active && !!p.input?.catching && !p.bucketPos && !p.vehicle && !p.cart && !p.mineCart && !p.hoistRide && !p.busy && !p.tumble; }
export function heldBucketPose(p, input=p.input || {}) {
  const catching=catchingBucket({...p,input}),yaw=Number.isFinite(input.yaw)?input.yaw:p.yaw,pitch=clamp(Number(input.pitch)||0,-1.38,1.38);
  const lx=-.48+(catching?clamp(Number(input.bucketX)||0,-.75,.75)*.9:0),ly=catching ? -.48+clamp(Number(input.bucketY)||0,-.65,.65)*.65 : -.53,lz=catching ? -.90 : -.85;
  const ry=Math.cos(pitch)*ly-Math.sin(pitch)*lz,rz=Math.sin(pitch)*ly+Math.cos(pitch)*lz;
  return {x:p.x+Math.cos(yaw)*lx+Math.sin(yaw)*rz,y:p.y+1.65+ry,z:p.z-Math.sin(yaw)*lx+Math.cos(yaw)*rz,local:{x:lx,y:ly,z:lz},catching};
}
export function shovelOrigin(p, yaw, pitch) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  return { x: p.x - Math.sin(yaw) * cp * .8 + Math.cos(yaw) * .22,
    y: p.y + 1.55 + sp * .8, z: p.z - Math.cos(yaw) * cp * .8 - Math.sin(yaw) * .22 };
}
export function looseSoil(room, parcel, x, z,y) {
  if (parcel.mass < .000001) return;
  const pos = { x: clamp(x,-108,108),z:clamp(z,-108,108),...(Number.isFinite(y)?{y}: {}) };
  let pile = room.spills.find(s => distance(s,pos)<1.1&&Math.abs((s.y??heightAt(s.x,s.z,room.cells))-(pos.y??heightAt(x,z,room.cells)))<1);
  if (!pile) { pile = { id: `s${room.nextId++}`, ...pos, cargo: emptyCargo() }; room.spills.push(pile); }
  addCargo(pile.cargo, parcel); mark(room);
}
export function soilAction(room, p, action, rules, now) {
  if (!['shovelPlant', 'shovelCancel', 'shovelThrow', 'bucket'].includes(action.type)) return null;
  ensureSoil(room);
  if (action.type === 'shovelCancel') { p.shovelPlant = null; return good(); }
  if (p.vehicle || p.cart || p.mineCart || p.hoistRide || p.busy || p.tumble) return fail('Free your hands and get on your feet first.');
  if (action.type === 'bucket') {
    if (p.bucketPos) {
      if (distance(p, p.bucketPos) > 3.8) return fail('Walk back to your bucket to pick it up.');
      p.bucketPos = null; mark(room); return good('Bucket picked up.');
    }
    const x = p.x - Math.sin(p.yaw) * 1.55, z = p.z - Math.cos(p.yaw) * 1.55;
    if (!canWalk(x, z, .5)) return fail('Leave room for your bucket.');
    p.bucketPos = {x,z,...(inMine(p.x,p.z)?{y:groundAt(room,x,z,p.y)}:{})}; mark(room); return good('Bucket down. Aim into the opening and release a gentle shovel toss. T picks it up.');
  }
  if (action.type === 'shovelPlant') {
    if (p.shovel?.mass) return fail('Empty the shovel before digging again. Aim, flick, and release.');
    const x = Number(action.x), z = Number(action.z);
    if (!Number.isFinite(x) || !Number.isFinite(z) || distance(p, {x,z}) > rules.player.reach || Math.abs(x) > 108 || Math.abs(z) > 108) return fail('Look down at nearby dirt.');
    if (now < p.digUntil) return { ok: false, quiet: true };
    p.shovelPlant = {x,z,at:now,...(action.mine?{y:Number(action.y),mine:true}:{})}; mark(room); return good('', { shovel: 'planted' });
  }
  if (!p.shovel?.mass) return fail('The shovel is empty. Hold left mouse on dirt and pull upward.');
  if (room.clods.length > 150) return fail('Let the flying dirt settle before throwing another load.');
  if (![action.yaw, action.pitch, action.power].every(Number.isFinite)) return fail('Invalid shovel movement.');
  const yaw = action.yaw % (Math.PI * 2), pitch = clamp(action.pitch, -1.38, 1.38), power = clamp(action.power, 0, 1);
  const lob=!!action.lob&&!p.bucketPos;
  const origin = lob?{x:p.x+Math.cos(yaw)*.18-Math.sin(yaw)*.80,y:p.y+1.6,z:p.z-Math.sin(yaw)*.18-Math.cos(yaw)*.80}:shovelOrigin(p, yaw, pitch), speed = 3.2 + power * 7.5, parcel = p.shovel;
  // Gentle release drops near the blade; a faster wrist movement gives a longer arc.
  for (let i = 0; i < 5; i++) {
    const cargo = takeCargo(parcel, parcel.mass / (5 - i));
    room.clods.push({ id: `d${room.nextId++}`, owner: p.id, catchLob:lob, ...origin,
      x: origin.x + (i - 2) * .035, z: origin.z + (i % 2 - .5) * .035,
      vx: (lob?Math.sin(yaw)*.06:-Math.sin(yaw) * Math.cos(pitch) * speed) + (i - 2) * .04,
      vz: (lob?Math.cos(yaw)*.06:-Math.cos(yaw) * Math.cos(pitch) * speed) + (i % 2 - .5) * .08,
      vy: lob?5.8+power*1.2:Math.sin(pitch) * speed + .7 + power * 2, age: 0, bounces: 0, cargo });
  }
  p.shovel = null; p.shovelPlant = null; mark(room);
  return good('', { shovel: 'thrown', effect: {type:'throw',player:p.id,x:origin.x,y:origin.y,z:origin.z} });
}
export function soilReceivers(room, rules) {
  const out = [];
  for (const p of Object.values(room.players)) {
    const b = p.bucketPos || (p.active && !p.vehicle && !p.cart && !p.busy ? heldBucketPose(p) : null);
    if (b) out.push({ id:`bucket-${p.id}`, x:b.x,z:b.z,y:p.bucketPos?(b.y??heightAt(b.x,b.z,room.cells))+.57:b.y+.57*.72,radius:p.bucketPos?.43:.35, cargo:p.cargo, capacity:bucketCapacity(p,rules) });
  }
  for(const c of room.mine?.carts||[])out.push({id:c.id,x:c.x,z:c.z,y:c.y+.88,radius:.55,cargo:c.cargo,capacity:240});
  for (const c of room.carts || []) if (!c.tipped) out.push({id:c.id,x:c.x,z:c.z,y:heightAt(c.x,c.z,room.cells)+1.22,radius:.75,cargo:c.cargo,capacity:180});
  for (const m of room.machines) {
    const cfg=rules.catalog.find(c=>c.id===m.type),offset=m.type==='washplant'?2.8:0;
    out.push({id:m.id,x:m.x-Math.sin(m.yaw)*offset,z:m.z-Math.cos(m.yaw)*offset,y:heightAt(m.x,m.z,room.cells)+(m.type==='washplant'?5.15:m.type==='rocker'?1.55:1.3),radius:m.type==='washplant'?1.5:.8,cargo:m.cargo,capacity:cfg.capacity});
  }
  for (const v of room.vehicles) if(v.type==='truck') out.push({id:v.id,x:v.x+Math.sin(v.yaw)*1.1,z:v.z+Math.cos(v.yaw)*1.1,y:heightAt(v.x,v.z,room.cells)+2.25,radius:1.45,cargo:v.cargo,capacity:2400});
  return out;
}
export function tickSoil(room,rules,dt,now=Date.now()) {
  ensureSoil(room); if (!room.clods.length) return [];
  const events=[],receivers=soilReceivers(room,rules),remaining=[];
  // Small substeps avoid flying through a bucket rim on slow simulation frames.
  const steps=Math.max(1,Math.ceil(dt/.02)),step=dt/steps;
  for (const c of room.clods) {
    let settled=false;
    for(let i=0;i<steps&&!settled;i++) {
      const old={x:c.x,y:c.y,z:c.z}; c.age+=step;c.vy-=9.8*step;
      c.x=clamp(c.x+c.vx*step,-108,108);c.z=clamp(c.z+c.vz*step,-108,108);c.y+=c.vy*step;
      if(!canWalk(c.x,c.z,.1)||inMine(c.x,c.z)&&mineSolid(room.mine,c.x,c.y,c.z)){c.x=old.x;c.z=old.z;c.vx*=-.28;c.vz*=-.28;}
      for(const r of receivers) {
        if(old.y>=r.y-.02&&c.y<=r.y&&c.vy<0) {
          const t=clamp((old.y-r.y)/(old.y-c.y||1),0,1),x=old.x+(c.x-old.x)*t,z=old.z+(c.z-old.z)*t;
          if(distance({x,z},r)<r.radius) {
            const part=takeCargo(c.cargo,Math.max(0,r.capacity-r.cargo.mass));
            if(part.mass>0){addCargo(r.cargo,part);mark(room);events.push({effect:{type:'catch',x:r.x,y:r.y,z:r.z,receiver:r.id}});}
            if(c.cargo.mass<1e-8){settled=true;break;}
          }
        }
      }
      // The catch challenge has a comic rebound: an uncaught lob springs back at its thrower.
      // Bucket openings resolve first, so successful catches never cause a face splat.
      const owner=Object.values(room.players).find(p=>p.id===c.owner);
      if(!settled&&c.catchLob&&!c.faceReturn&&c.vy<0&&owner?.active&&!owner.vehicle&&!owner.tumble&&c.y<=owner.y+1.30){
        c.faceReturn=true;c.vx=(owner.x-Math.sin(owner.yaw)*.08-c.x)/.14;c.vz=(owner.z-Math.cos(owner.yaw)*.08-c.z)/.14;c.vy=(owner.y+1.70-c.y)/.14+.7;
      }
      // Test a swept segment against real faces, after bucket openings get their chance.
      if(!settled)for(const p of Object.values(room.players)) {
        if(!p.active||p.vehicle||p.tumble||c.age<.13)continue;
        // An upward lob passes in front of the face. Its descending return is the catch challenge.
        if(c.owner===p.id&&!c.faceReturn&&(c.vy>=0||c.y>p.y+1.80))continue;
        const face={x:p.x-Math.sin(p.yaw)*.08,y:p.y+1.70,z:p.z-Math.cos(p.yaw)*.08};
        const dx=c.x-old.x,dy=c.y-old.y,dz=c.z-old.z,len=dx*dx+dy*dy+dz*dz;
        const t=clamp(((face.x-old.x)*dx+(face.y-old.y)*dy+(face.z-old.z)*dz)/(len||1),0,1);
        if(Math.hypot(old.x+dx*t-face.x,old.y+dy*t-face.y,old.z+dz*t-face.z)<.40) {
          p.muddyUntil=now+3000;looseSoil(room,c.cargo,p.x,p.z,inMine(p.x,p.z)?p.y:undefined);settled=true;
          events.push({effect:{type:'mud',player:p.id,x:face.x,y:face.y,z:face.z,until:p.muddyUntil}});break;
        }
      }
      const ground=groundAt(room,c.x,c.z,old.y)+.10;
      if(!settled&&c.y<=ground) {
        c.y=ground;c.bounces++;c.vy=Math.abs(c.vy)*.19;c.vx*=.45;c.vz*=.45;
        if(c.bounces>=3||Math.hypot(c.vx,c.vz)<.5){looseSoil(room,c.cargo,c.x,c.z,inMine(c.x,c.z)?ground-.1:undefined);settled=true;}
      }
      if(!settled&&c.age>8){looseSoil(room,c.cargo,c.x,c.z,inMine(c.x,c.z)?ground-.1:undefined);settled=true;}
    }
    if(!settled) remaining.push(c);
  }
  room.clods=remaining;room.dirty=true;return events;
}
