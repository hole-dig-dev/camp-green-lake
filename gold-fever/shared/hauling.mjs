import { distance, heightAt, canWalk, clamp } from './world.mjs';
import { emptyCargo, addCargo, takeCargo } from './cargo.mjs';
import {inCanyon} from './canyon.mjs';
import {inMine,groundAt,mineBodyClear} from './mine.mjs';

export const CART_CAPACITY = 180, SAFE_LOAD = 72;
const ok = (message, extra = {}) => ({ ok: true, message, ...extra });
const no = message => ({ ok: false, message });
const dirty = r => { r.dirty = true; r.revision++; };
export function ensureHauling(room) {
  room.carts ??= [{ id: `c${room.nextId++}`, x: -18, z: 58, yaw: -Math.PI / 2, vx: 0, vz: 0, cargo: emptyCargo(), operator: null, brake: true, tipped: false, wobble: 0, roll: 0, wheel: 0 }];
  room.spills ??= [];
  for (const p of Object.values(room.players)) { p.cart ??= null; p.tumble ??= null; p.aid ??= 0; }
}
export function releaseCart(room, p, park = false) {
  const c = room.carts?.find(c => c.operator === p.id);
  if (c) { c.operator = null; if (park) { c.brake = true; c.vx = c.vz = 0; } }
  p.cart = null;
}
export function tumble(room, p, now, vx = 0, vz = 0) {
  if (p.vehicle || p.tumble || p.fly || p.cheatSafe || p.immuneUntil > now) return;
  releaseCart(room, p); p.tumble = { until: now + 12000, vx, vz }; p.aid = 0;
  if (p.busy) { addCargo(p.cargo, p.busy.sample); p.busy = null; }
  dirty(room);
}
export function spillCart(room, c, now, tip = true) {
  if (c.cargo.mass > .001) {
    const cargo = takeCargo(c.cargo, c.cargo.mass * (tip ? .85 : 1));
    const x = clamp(c.x + Math.cos(c.yaw) * 1.2, -107, 107), z = clamp(c.z - Math.sin(c.yaw) * 1.2, -107, 107);
    const pile = room.spills.find(s => distance(s, { x, z }) < 2.5);
    if (pile) addCargo(pile.cargo, cargo);
    else room.spills.push({ id: `s${room.nextId++}`, x, z, cargo });
  }
  c.tipped = tip; c.brake = true; c.roll = tip ? 1.4 : 0; c.wobble = 0;
  if (tip && c.operator) { const p = Object.values(room.players).find(p => p.id === c.operator); if (p) tumble(room, p, now, c.vx * .4, c.vz * .4); }
  c.operator = null; for (const p of Object.values(room.players)) if (p.cart === c.id) p.cart = null;
  c.vx = c.vz = 0; dirty(room);
}
export function haulingAction(room, p, action, rules, now) {
  if (!['cart', 'cartBrake', 'cartTip', 'retrieve'].includes(action.type)) return null;
  ensureHauling(room);
  if (p.vehicle || p.tumble || p.busy) return no('Get on your feet and finish washing before handling a load.');
  if (action.type === 'retrieve') {
    const source = room.carts.find(c => c.id === action.target) || room.spills.find(s => s.id === action.target);
    if (!source || distance(p, source) > 3.8) return no('Move beside the wheelbarrow or spilled gravel.');
    const capacity = p.upgrades.includes('bucket') ? 64 : rules.player.bucketKg;
    const amount = Math.min(source.cargo.mass, capacity - p.cargo.mass);
    if (amount <= .001) return no(source.cargo.mass < .001 ? 'No gravel left to recover.' : 'Your bucket is full. Wash or unload it first.');
    addCargo(p.cargo, takeCargo(source.cargo, amount));
    room.spills = room.spills.filter(s => s.cargo.mass > 1e-8); dirty(room);
    return ok(`Recovered ${Math.round(amount)} kg. The gold stays with the gravel.`);
  }
  const c = room.carts.find(c => c.id === (action.target || p.cart));
  if (!c || distance(p, c) > 3.8) return no('Stand beside a wheelbarrow.');
  if (action.type === 'cartBrake') {
    c.brake = !c.brake; dirty(room); return ok(c.brake ? 'Parking brake on. Safe to let go.' : 'Brake released. Mind the slope!');
  }
  if (action.type === 'cartTip') {
    if (c.operator && c.operator !== p.id) return no('Your friend has the handles. Ask them to let go.');
    if (Math.hypot(c.vx, c.vz) > .7) return no('Stop the wheelbarrow before tipping or righting it.');
    if (c.tipped) { c.tipped = false; c.roll = 0; c.brake = true; dirty(room); return ok('Wheelbarrow upright. X retrieves gravel from the spill.'); }
    spillCart(room, c, now, false); return ok('Load dumped into a recoverable gravel pile.');
  }
  if (p.cart === c.id) { releaseCart(room, p); dirty(room); return ok('Handles released. F toggles the parking brake.'); }
  if (c.tipped) return no('G rights the wheelbarrow first.');
  if (c.operator) return no('Your friend has the handles. Hold H nearby to steady the load.');
  releaseCart(room, p); p.cart = c.id; c.operator = p.id; c.brake = false;
  p.x = c.x + Math.sin(c.yaw) * 1.55; p.z = c.z + Math.cos(c.yaw) * 1.55;
  p.y = heightAt(p.x, p.z, room.cells); p.yaw = c.yaw; dirty(room);
  return ok('W/S pushes, look to steer. Hold Space to brake. Q lets go; F parks it.');
}
export function loadCart(room, p, id) {
  const c = room.carts.find(c => c.id === id);
  if (!c || distance(p, c) > 3.8) return no('Move closer to the wheelbarrow.');
  if (c.tipped) return no('G rights the wheelbarrow before loading it.');
  const amount = Math.min(p.cargo.mass, CART_CAPACITY - c.cargo.mass);
  if (amount < .001) return no(p.cargo.mass < .001 ? 'Dig gravel to load, or press X to take some back.' : 'The wheelbarrow is full.');
  addCargo(c.cargo, takeCargo(p.cargo, amount)); dirty(room);
  return ok(`Loaded ${Math.round(amount)} kg.${c.cargo.mass > SAFE_LOAD ? ' Overloaded: slow down and brake before turning.' : ''}`);
}
export function tickHauling(room, rules, dt, now) {
  ensureHauling(room); const events = [], players = Object.values(room.players);
  for (const p of players) {
    if (!p.active || !p.tumble) continue;
    const h = players.find(h => h.active && h.id !== p.id && !h.tumble && !h.vehicle && !h.cart && now - h.lastInput < 600 && h.input.help && distance(h, p) < 2.8);
    const selfAid = now - p.lastInput < 600 && p.input.jump;
    p.aid = h || selfAid ? p.aid + dt * (h ? 1.7 : 1) : Math.max(0, p.aid - dt * .5);
    const nx = p.x + p.tumble.vx * dt, nz = p.z + p.tumble.vz * dt;
    if (canWalk(nx, nz)&&(!inMine(nx,nz)||mineBodyClear(room.mine,nx,p.y,nz))) { p.x = nx; p.z = nz; } p.tumble.vx *= Math.exp(-4 * dt); p.tumble.vz *= Math.exp(-4 * dt); p.y = inMine(p.x,p.z)?groundAt(room,p.x,p.z,p.y):Math.max(.3,heightAt(p.x,p.z,room.cells));
    if (p.aid >= 2.2 || now >= p.tumble.until) {
      p.tumble = null; p.aid = 0; p.immuneUntil = now + 1800; p.vy = 0; dirty(room);
      events.push({ player: p.id, result: ok(h ? `${h.name} got you back on your feet!` : 'Back on your feet. Try a smaller load or a gentler turn.') });
    }
  }
  for (const c of room.carts) {
    const p = players.find(p => p.active && p.id === c.operator && p.cart === c.id && !p.tumble);
    if (!p && c.operator) { c.operator = null; c.brake = true; c.vx = c.vz = 0; }
    if (c.tipped) continue;
    const i = p && now - p.lastInput < 600 ? p.input : {};
    const helpers = players.filter(h => h.active && h.id !== p?.id && !h.tumble && !h.vehicle && !h.cart && now - h.lastInput < 600 && h.input.help && distance(h, c) < 2.8);
    c.steadier = helpers[0]?.id || null;
    const h0 = heightAt(c.x, c.z, room.cells);
    const gx = (heightAt(c.x + .6, c.z, room.cells) - heightAt(c.x - .6, c.z, room.cells)) / 1.2;
    const gz = (heightAt(c.x, c.z + .6, room.cells) - heightAt(c.x, c.z - .6, room.cells)) / 1.2;
    const load = c.cargo.mass / SAFE_LOAD, brake = c.brake || !!i.jump || (!p&&helpers.length>0);
    const speed = Math.hypot(c.vx, c.vz), oldYaw = c.yaw;
    if (p && Number.isFinite(i.yaw)) {
      const turn = Math.atan2(Math.sin(i.yaw - c.yaw), Math.cos(i.yaw - c.yaw));
      c.yaw += clamp(turn, -1.8 * dt, 1.8 * dt) * (brake ? .25 : 1);
    }
    const throttle = p && !brake ? clamp(Number(i.forward) || 0, -1, 1) : 0;
    const drive = (i.sprint ? 5.5 : 3) / (1 + Math.max(0, load - 1) * .3);
    const gain = (brake ? 13 : p ? 3.5 : .5);
    c.vx += (-Math.sin(c.yaw) * throttle * drive - c.vx) * Math.min(1, gain * dt);
    c.vz += (-Math.cos(c.yaw) * throttle * drive - c.vz) * Math.min(1, gain * dt);
    if (!brake) { c.vx -= gx * 6 * dt; c.vz -= gz * 6 * dt; } else { c.vx *= Math.exp(-10 * dt); c.vz *= Math.exp(-10 * dt); }
    const nx = c.x + c.vx * dt, nz = c.z + c.vz * dt;
    const operatorX = nx + Math.sin(c.yaw) * 1.55, operatorZ = nz + Math.cos(c.yaw) * 1.55;
    if (canWalk(nx, nz, .8) && (!p || canWalk(operatorX, operatorZ, .4)) && Math.abs(heightAt(nx, nz, room.cells) - h0) < .7) { c.x = nx; c.z = nz; }
    else { c.vx = c.vz = 0; }
    if(!p&&helpers.length&&Math.hypot(c.vx,c.vz)<.35&&!c.brake){c.brake=true;dirty(room);events.push({effect:{type:'catch',x:c.x,y:h0+1,z:c.z,receiver:c.id,mass:c.cargo.mass},broadcast:`${helpers[0].name} caught the runaway wheelbarrow!`});}
    c.wheel += Math.hypot(c.vx, c.vz) * dt / .35;
    const lateral = Math.abs((c.yaw - oldYaw) / Math.max(.001, dt)) * speed;
    const unstable = Math.max(0, load - .6) * (lateral * .14 + Math.hypot(gx, gz) * speed * .7);
    c.wobble = clamp(c.wobble + (unstable * (helpers.length ? .2 : 1) - (brake ? 2 : .32)) * dt, 0, 1.2);
    c.roll = Math.sin(c.wheel * .6) * c.wobble * .55;
    if (p) { p.x = c.x + Math.sin(c.yaw) * 1.55; p.z = c.z + Math.cos(c.yaw) * 1.55; p.y = inCanyon(p.x,p.z)?heightAt(p.x,p.z,room.cells):Math.max(.3,heightAt(p.x,p.z,room.cells)); p.yaw = c.yaw; p.vy = 0; }
    if (c.wobble >= 1) {
      spillCart(room, c, now);
      events.push({ broadcast: 'Wheelbarrow over! The spilled gravel can be recovered.', effect: { type: 'spill', x: c.x, z: c.z } });
      continue;
    }
    if (speed > 2.7) for (const q of players) if (q.active && q.id !== p?.id && !q.vehicle && !q.cart && !q.tumble && distance(q, c) < .85) {
      tumble(room, q, now, c.vx * .5, c.vz * .5); c.vx *= .35; c.vz *= .35;
      events.push({ player: q.id, result: ok('Watch the wheelbarrow! Hold Space to get up, or a friend can hold H to help.') });
    }
  }
  return events;
}
