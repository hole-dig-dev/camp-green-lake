import {ensureRelics,tickRelics,relicAction,sellRelics,relicSlow,relicSignal,relicPublic,relicBagPublic,relicQuest} from './relics.mjs';
import {ensureGuards,tickGuards,guardsPublic,applyGuardKnock} from './guards.mjs';
import {fitRockerDrive,tickAutomation} from './automation.mjs';
import {ensureArm,tickArm,excavatorAction} from './excavator.mjs';
import {miningTool,handGesture} from './tools.mjs';
import {ensureForest,forestryAction,forestPublic} from './forestry.mjs';
import {ensureSupports,supportAction,tickStability,stabilityPublic} from './supports.mjs';
import {ensureMine,mineAction,digMine,tickMine,mineStep,inMine,minePublic} from './mine.mjs';
import { hash, random, distance, clamp, toCell, fromCell, keyOf, heightAt, nearWater, protectedGround, canWalk, goldInScoop, gradeName, GRID } from './world.mjs';

import { emptyCargo, addCargo, takeCargo } from './cargo.mjs';
import { ensureHauling, haulingAction, loadCart, tickHauling, tumble } from './hauling.mjs';
import { runConsole, flyStep } from './console.mjs';
import { ensureSoil, soilAction, tickSoil, catchingBucket } from './soil.mjs';
export { emptyCargo, addCargo, takeCargo } from './cargo.mjs';
export const equipmentPrice = (room, item) => Math.round(item.price * (1 + .65 * ((room.crewSize || 1) - 1)) * 100);
export function createRoom(code, rules, mode = 'rush', crewSize = 1) {
  const room = { version: 1, code, seed: hash(code), mode, crewSize: clamp(Math.floor(crewSize) || 1, 1, 8), ownerId: null, cash: mode === 'sandbox' ? rules.economy.sandboxCash * 100 : 0,
    cells: {}, players: {}, machines: [], vehicles: [], unlocked: [], totalGoldMg: 0, totalDugKg: 0,
    day: 1, clock: 8, revision: 0, nextId: 1, dirty: true };
  ensureHauling(room); ensureSoil(room); ensureMine(room);ensureForest(room);ensureSupports(room);ensureGuards(room);ensureRelics(room); return room;
}
export function createPlayer(token, name, room) {
  const n = Object.keys(room.players).length;
  const p = { id: `p${hash(token).toString(36)}`, name, color: n % 8, x: -25 + (n % 4) * 1.4, z: 58 + Math.floor(n % 8 / 4) * 2, y: 3.15, yaw: -1.05,
    vy: 0, wood:0, cargo: emptyCargo(), goldMg: 0, upgrades: [], kits: [], samples: [], busy: null, vehicle: null,
    active: true, input: {}, lastInput: 0, cart: null, tumble: null, aid: 0, digUntil: 0, emoteUntil: 0, stats: { dug: 0, sold: 0, pans: 0 } };
  room.players[token] = p;
  room.ownerId ??= p.id;
  if (room.mode === 'sandbox') {
    p.upgrades = ['sieve', 'shovel', 'minerpick', 'mattock', 'tunnelpick', 'bucket', 'boots'];
    if (!room.vehicles.length) {
      room.unlocked = rulesMachineIds();
      p.kits = ['rocker', 'sluice', 'washplant'];
      room.vehicles.push(makeVehicle(room, 'excavator', -17, 43), makeVehicle(room, 'truck', -19, 55), makeVehicle(room, 'hydraulic', -12, 32));
    }
  }
  return p;
}
const rulesMachineIds = () => ['rocker', 'sluice', 'excavator', 'truck', 'washplant', 'hydraulic'];
function makeVehicle(room, type, x, z) { return { id: `v${room.nextId++}`, type, x, z, yaw: -.8, cargo: emptyCargo(), driver: null, tipped: 0, swing: 0 }; }
export const config = (rules, id) => rules.catalog.find(i => i.id === id);
export const bucketCapacity = (p, rules) => p.upgrades.includes('bucket') ? 64 : rules.player.bucketKg;
export function cancelPan(p) { if (p.busy) { addCargo(p.cargo, p.busy.sample); p.busy = null; } }
const fail = (message) => ({ ok: false, message });
const good = (message, extra = {}) => ({ ok: true, message, ...extra });
function mark(room) { room.revision++; room.dirty = true; }

export function act(room, p, action, rules, now) {
  if (!p.active) return fail('Reconnect to the crew first.');
  if (action.type === 'console') return runConsole(room, p, action.line, rules, now);
  if (action.type === 'crewSize') {
    if (p.id !== room.ownerId) return fail('Only the world creator can change crew capacity.');
    const size = Number(action.size);
    if (!Number.isInteger(size) || size < (room.crewSize || 1) || size > 8) return fail('Crew capacity can increase up to eight.');
    room.crewSize = size; mark(room); return good(`Crew capacity increased to ${size}. Equipment prices updated.`, { broadcast: true });
  }
  if (p.bucketPos && distance(p, p.bucketPos) > 3.8 && ['pan','interact','retrieve'].includes(action.type)) return fail('Pick up your bucket with T before moving its gravel.');
  if (p.shovel?.mass && ['pan','enter','cart'].includes(action.type)) return fail('Empty your shovel first: aim, flick, and release left mouse.');
  const relic=relicAction(room,p,action);if(relic)return relic;
  const fitting=fitRockerDrive(room,p,action);if(fitting)return fitting;
  const excavation=excavatorAction(room,p,action,rules,now);if(excavation)return excavation;
  const forestry=forestryAction(room,p,action,now);if(forestry)return forestry;const support=supportAction(room,p,action);if(support)return support;
  const mining=mineAction(room,p,action,rules,now);if(mining)return mining;
  const hauling = haulingAction(room, p, action, rules, now); if (hauling) return hauling;
  if (p.tumble && !['emote'].includes(action.type)) return fail('Hold Space to get up. A friend can hold H beside you to help.');
  const v = p.vehicle && room.vehicles.find(v => v.id === p.vehicle);
  const soil = soilAction(room, p, action, rules, now); if (soil) return soil;
  if (action.type === 'dig' || action.type === 'shovelLift') {
    const physical = action.type === 'shovelLift';
    if (physical && (!p.shovelPlant || now - p.shovelPlant.at < handGesture(p,p.shovelPlant.tool).plantMs || !Number.isFinite(action.pull) || action.pull < handGesture(p,p.shovelPlant?.tool).pull || p.shovel?.mass || v)) return fail('Hold the blade in the dirt and drag upward to lift.');
    if(physical&&p.shovelPlant?.mine)return digMine(room,p,p.shovelPlant,rules,now,true);
    if (p.cart||p.mineCart||p.hoistRide) return fail('Release the cart or exit the cage before digging.');
    if (p.busy) return fail('Finish washing your pan first.');
    if(v?.type==='excavator')return fail('Move the actual bucket onto dirt, hold left and pull up to scoop.');
    if (v?.type === 'truck') return fail('A truck hauls gravel. Use an excavator to dig.');
    if (now < p.digUntil) return { ok: false, quiet: true };
    const cfg = v ? config(rules, v.type) : rules.player;
    const upgraded = !v && p.upgrades.includes('shovel');
    const reach = v ? cfg.reach : rules.player.reach;
    const x = physical ? p.shovelPlant.x : Number(action.x), z = physical ? p.shovelPlant.z : Number(action.z);
    if (!Number.isFinite(x) || !Number.isFinite(z) || distance(v || p, { x, z }) > reach || Math.abs(x) > 108 || Math.abs(z) > 108) return fail('Move closer to the ground you want to dig.');
    if (protectedGround(x, z)) return fail('Town rule: leave the street and buildings standing.');
    const { ix, iz } = toCell(x, z), key = keyOf(ix, iz);
    const cell = room.cells[key] || { depth: 0, digs: 0 };
    if (cell.depth >= rules.world.maxDepth) return fail('Solid bedrock. Try another spot.');
    const cargo = physical ? emptyCargo() : v ? v.cargo : p.cargo, capacity = physical ? Infinity : v ? cfg.capacity : bucketCapacity(p, rules);
    const mass = v ? cfg.digKg : upgraded ? 10 : rules.player.digKg;
    if (cargo.mass + mass > capacity + .001) return fail(v ? 'Bucket full. Transfer gravel to a truck or washer with E.' : 'Your bucket is full. Pan it at the creek with R, or load a washer with E.');
    const pos = fromCell(ix, iz), mg = goldInScoop(room.seed, ix, iz, cell.depth, cell.digs, mass);
    addCargo(cargo, { mass, goldMg: mg, ...pos });
    if (physical) { p.shovel = cargo; p.shovelPlant = null; }
    const cut = v ? v.type === 'hydraulic' ? .8 : .48 : upgraded ? .22 : .15;
    const radius = v ? v.type === 'hydraulic' ? 2 : 1 : 0;
    const patches = [];
    for (let oz = -radius; oz <= radius; oz++) for (let ox = -radius; ox <= radius; ox++) {
      if (ix + ox < 1 || ix + ox >= GRID || iz + oz < 1 || iz + oz >= GRID) continue;
      const k = keyOf(ix + ox, iz + oz), c = room.cells[k] || { depth: 0, digs: 0 };
      c.depth = Math.min(rules.world.maxDepth, c.depth + cut / (1 + Math.hypot(ox, oz) * 2));
      if (!ox && !oz) c.digs++;
      room.cells[k] = c; patches.push({ key: k, ...c });
    }
    p.digUntil = now + (v ? cfg.digSeconds : upgraded ? .58 : rules.player.digSeconds) * 1000;
    if (v) v.swing = now;
    p.stats.dug += mass; room.totalDugKg += mass; mark(room);
    return good('', { ...(physical ? {shovel:'loaded'} : {}), patches, effect: { type: 'dig', x: pos.x, z: pos.z, player: p.id, large: !!v } });
  }
  if (action.type === 'pan') {
    if (v || p.cart) return fail('Let go of your machine to use the pan.');
    if (p.busy) { cancelPan(p); mark(room); return good('Unwashed gravel returned to your bucket.'); }
    if (p.cargo.mass <= 0) return fail('Dig some gravel before using your pan.');
    if (!nearWater(p.x, p.z, 13) || heightAt(p.x, p.z, room.cells) > 4.5) return fail('Take your bucket to the creek to pan.');
    p.busy = { sample: takeCargo(p.cargo, rules.player.panKg), progress: 0, settle: 0 };
    mark(room); return good('Hold mouse or Space to wash. Release at the last stage to settle the gold.');
  }
  if (action.type === 'sell') {
    const assay = rules.landmarks.find(l => l.id === 'assay');
    if (distance(p, assay) > assay.radius + 1) return fail('Sell your gold at Bill’s Assay in town.');
    if (p.goldMg < .34&&!relicBagPublic(room,p).length) return fail('Bring Bill recovered gold or a buried find. Dirt goes in a pan or washer first.');
    const relicSale=sellRelics(room,p);
    const cents = Math.floor(p.goldMg * rules.economy.dollarsPerGram / 10)+relicSale.value;
    room.cash += cents; room.totalGoldMg += p.goldMg; p.stats.sold += p.goldMg; p.goldMg = 0; mark(room);
    return good(`${relicSale.motherlode?"MOTHERLODE CLAIMED! ":""}Bill paid ${(cents / 100).toFixed(2)} into the crew treasury.${relicSale.count?` ${relicSale.count} finds added to the crew collection.`:""}`, { broadcast: true,...(relicSale.count?{effect:{type:"relicSale",x:p.x,y:p.y+1,z:p.z,player:p.id}}:{}) });
  }
  if (action.type === 'buy') {
    const vendor = rules.landmarks.find(l => l.id === 'supplier');
    if (distance(p, vendor) > vendor.radius + 1) return fail('Visit Mabel’s Hardware to buy equipment.');
    const item = config(rules, action.item);
    if (!item) return fail('That equipment is unavailable.');
    if(item.craftWood)return fail('Cut down trees to get wood. Craft log supports in B; they cannot be bought.');
    if (item.kind === 'personal' && p.upgrades.includes(item.id)) return fail('You already own that upgrade.');
    if(item.requiresPersonal&&!p.upgrades.includes(item.requiresPersonal))return fail(`You need your own ${config(rules,item.requiresPersonal).name} first.`);
    if (item.requires && !room.unlocked.includes(item.requires)) return fail(`First build up to ${config(rules, item.requires).name}.`);
    const price = equipmentPrice(room, item);
    if (room.cash < price) return fail('The crew needs more gold to afford that.');
    if (room.machines.length + room.vehicles.length + Object.values(room.players).reduce((n, p) => n + p.kits.length, 0) >= 40 && item.kind !== 'personal') return fail('The equipment yard is full.');
    room.cash -= price;
    if (item.kind === 'personal') p.upgrades.push(item.id);
    else if (item.kind === 'machine'||item.kind==='mine') {for(let i=0;i<(item.bundle||1);i++)p.kits.push(item.id);}
    else room.vehicles.push(makeVehicle(room, item.id, -18 + (room.vehicles.length % 3) * 6, 49 - Math.floor(room.vehicles.length / 3) * 10));
    if (!room.unlocked.includes(item.id)) room.unlocked.push(item.id);
    mark(room); return good(`${p.name} bought ${item.name}.${item.kind === 'machine' ? ' Press B to place it near the creek.' : item.kind === 'vehicle' ? ' Delivered to the town equipment yard.' : ''}`, { broadcast: true });
  }
  if (action.type === 'deploy') {
    const i = p.kits.indexOf(action.item), cfg = config(rules, action.item);
    if (i < 0 || !cfg) return fail('Buy or pack up that equipment first.');
    const x = Number(action.x), z = Number(action.z);
    if (!Number.isFinite(x) || !Number.isFinite(z) || distance(p, { x, z }) > 10 || Math.abs(x) > 105 || Math.abs(z) > 105) return fail('Choose a nearby place for your equipment.');
    if (distance(p, { x, z }) < (cfg.placementClearance || 0)) return fail(`Leave ${cfg.placementClearance} metres of space for this large washer. Aim farther along the bank.`);
    if (protectedGround(x, z)) return fail('Place your washer outside town, near the creek.');
    if (!nearWater(x, z, cfg.waterReach)) return fail('That washer needs a water supply. Place it closer to the creek.');
    if (heightAt(x, z, room.cells) < .65) return fail('Place the equipment on the bank, above the water.');
    if (room.machines.some(m => distance(m, { x, z }) < (cfg.id==='feeder'||m.type==='feeder'?2.8:4))) return fail('Leave a little room between machines.');
    p.kits.splice(i, 1);
    room.machines.push({ id: `m${room.nextId++}`, type: cfg.id, x, z, yaw: Number(action.yaw) || 0, cargo: emptyCargo(), goldMg: 0, processed: 0, running: false });
    mark(room); return good(`${cfg.name} set up.${cfg.id==='feeder'?' Drop piles beside the hopper; aim the raised end into a washer. H clears jams.':''} E loads your bucket. E with an empty bucket collects gold.`, { broadcast: true });
  }
  if (action.type === 'pack') {
    const m = room.machines.find(m => m.id === action.target);
    if (!m || distance(p, m) > 5) return fail('Move next to the washer.');
    if (m.cargo.mass > .001 || m.goldMg > .01) return fail('Process the gravel and collect the gold before packing up.');
    p.kits.push(m.type);if(m.powered)p.kits.push('rockerdrive'); room.machines.splice(room.machines.indexOf(m), 1); mark(room); return good('Washer packed. Press B to place it somewhere else.');
  }
  if (action.type === 'enter') {
    if (p.cart) return fail('Q releases the wheelbarrow before driving.');
    if (v) { p.excavatorPlant=null;v.driver = null; p.vehicle = null; p.x = v.x + Math.cos(v.yaw) * 4; p.z = v.z - Math.sin(v.yaw) * 4; p.y = heightAt(p.x, p.z, room.cells); mark(room); return good('Back on foot.'); }
    const vehicle = room.vehicles.find(v => v.id === action.target);
    if (!vehicle || distance(p, vehicle) > 7) return fail('Stand beside a machine to get in.');
    if (vehicle.driver) return fail('Your crewmate is driving that machine.');
    ensureArm(vehicle);p.excavatorPlant=null;cancelPan(p); vehicle.driver = p.id; p.vehicle = vehicle.id; p.x = vehicle.x; p.z = vehicle.z; p.yaw = vehicle.yaw; mark(room); return good(vehicle.type==='excavator'?'Mouse controls the arm. Wheel folds the stick. Hold left at dirt and pull up to scoop. W/S drives; F exits.':'W/S drives, A/D steers. F gets out. E transfers gravel.');
  }
  if (action.type === 'interact') {
    const pile = room.spills.find(s => s.id === action.target);
    if (pile) return haulingAction(room, p, { type: 'retrieve', target: pile.id }, rules, now);
    const cart = room.carts.find(c => c.id === action.target);
    if (cart) return loadCart(room, p, cart.id);
    const m = room.machines.find(m => m.id === action.target), truck = room.vehicles.find(t => t.id === action.target);
    const heldCart = room.carts.find(c => c.id === p.cart);
    const source = v ? v.cargo : heldCart ? heldCart.cargo : p.cargo;
    if (m && distance(v || p, m) <= (v ? 12 : 5)) {
      if (source.mass > .001) {
        const cfg = config(rules, m.type), amount = Math.min(source.mass, cfg.capacity - m.cargo.mass);
        if (amount < .001) return fail('Washer is full. Wait for it to process more gravel.');
        addCargo(m.cargo, takeCargo(source, amount));
    if (v?.type === 'truck') v.tipped = now; mark(room); return good(`Loaded ${Math.round(amount)} kg into the ${cfg.name}.`);
      }
      if (m.goldMg > .01) { const mg = m.goldMg; p.goldMg += mg; m.goldMg = 0; mark(room); return good(`Clean-up: ${(mg / 1000).toFixed(3)} g of gold. Take it to Bill.`, { gold: mg }); }
      return fail(m.type === 'rocker' && m.cargo.mass ? 'Hold mouse beside the rocker to wash the gravel.' : 'Load this washer with gravel first.');
    }
    if (truck && truck.id !== v?.id && distance(v || p, truck) <= (v ? 13 : 6)) {
      if (source.mass < .001) return fail('Your gravel container is empty.');
      const amount = Math.min(source.mass, config(rules, truck.type).capacity - truck.cargo.mass);
      if (amount < .001) return fail('That vehicle is full.');
      addCargo(truck.cargo, takeCargo(source, amount)); mark(room); return good(`Transferred ${Math.round(amount)} kg of gravel.`);
    }
    return fail('Move beside a washer or hauling vehicle to transfer gravel.');
  }
  if (action.type === 'emote') { p.emoteUntil = now + 3500; return good(`${p.name}: YEEHAW!`, { broadcast: true, effect: { type: 'emote', player: p.id } }); }
  if (action.type === 'unstuck') { cancelPan(p); if (v || p.cart || p.mineCart || p.hoistRide) return fail('Let go of your vehicle first.'); if(inMine(p.x,p.z)&&p.y<5.9){const y=[...room.mine.levels].sort((a,b)=>Math.abs(a-p.y)-Math.abs(b-p.y))[0];p.x=-68;p.z=30;p.y=y;}else{p.x += 2.5;p.y = heightAt(p.x, p.z, room.cells) + .2;}p.vy = 0; return good('Moved to nearby ground.',{resync:true}); }
  return fail('Unknown action.');
}

export function tick(room, rules, dt, now) {
  const events = [];
  if (!Object.values(room.players).some(p => p.active)) return events;
  tickMine(room,dt,now);events.push(...tickStability(room,dt,now));
  events.push(...tickHauling(room, rules, dt, now));
  events.push(...tickSoil(room, rules, dt, now));
  room.clock += dt / 110; if (room.clock >= 24) { room.clock -= 24; room.day++; }
  for (const p of Object.values(room.players)) {
    if (!p.active) continue;
    const input = now - p.lastInput < 600 ? p.input : {};
    const v = p.vehicle && room.vehicles.find(v => v.id === p.vehicle);
    if (v) {
      tickArm(v,input,dt);
      const cfg = config(rules, v.type), throttle = clamp(Number(input.forward) || 0, -1, 1), steer = clamp(Number(input.right) || 0, -1, 1);
      if (throttle) v.yaw -= steer * dt * .85 * Math.sign(throttle);
      const speed = cfg.speed * throttle * (1 - v.cargo.mass / cfg.capacity * .18), nx = v.x - Math.sin(v.yaw) * speed * dt, nz = v.z - Math.cos(v.yaw) * speed * dt;
      if (canWalk(nx, nz, 1.5)) { v.x = nx; v.z = nz; }
      p.x = v.x; p.z = v.z; p.y = heightAt(p.x, p.z, room.cells); p.yaw = v.yaw;
    } else if(p.hoistRide||p.mineCart){ /* Authoritative rail and cage motion already applied. */
    } else if(inMine(p.x,p.z)&&!p.fly&&!p.cart&&!p.tumble){
      if(Number.isFinite(input.yaw))p.yaw=input.yaw;const speed=(input.sprint?rules.player.sprint:rules.player.speed)*(p.speedScale||1)*(p.upgrades.includes('boots')?1.2:1)*(1-p.cargo.mass/bucketCapacity(p,rules)*.24)*(p.busy?0:1)*relicSlow(room,p);applyGuardKnock(room.mine,p,dt,now);mineStep(room.mine,p,input,speed,dt);
    } else if (p.fly && !p.cart && !p.tumble) {
      flyStep(p,input,rules,p.speedScale,dt);
    } else if (!p.cart && !p.tumble) {
      if (Number.isFinite(input.yaw)) p.yaw = input.yaw;
      let f = clamp(Number(input.forward) || 0, -1, 1), r = clamp(Number(input.right) || 0, -1, 1), norm = Math.max(1, Math.hypot(f, r)); f /= norm; r /= norm;
      const speed = (input.sprint ? rules.player.sprint : rules.player.speed) * (p.speedScale || 1) * (p.upgrades.includes('boots') ? 1.2 : 1) * (1 - (p.bucketPos ? 0 : p.cargo.mass) / bucketCapacity(p, rules) * .24) * (p.busy ? 0 : 1) * relicSlow(room,p);
      const nx = p.x + (-Math.sin(p.yaw) * f + Math.cos(p.yaw) * r) * speed * dt, nz = p.z + (-Math.cos(p.yaw) * f - Math.sin(p.yaw) * r) * speed * dt;
      if (canWalk(nx, p.z)) p.x = nx; if (canWalk(p.x, nz)) p.z = nz;
      const ground = Math.max(.3, heightAt(p.x, p.z, room.cells));
      if (input.jump && p.y <= ground + .08 && !p.busy) p.vy = 5.6 * (p.jumpScale || 1);
      p.vy -= 15 * dt; p.y += p.vy * dt;
      if (p.y < ground) { if (dt <= .1 && p.vy < -10.5) tumble(room, p, now); p.y = ground; p.vy = 0; }
    }
    if (p.busy) {
      const b = p.busy;
      if (input.wash) { b.progress = Math.min(.88, b.progress + dt * (p.upgrades.includes('sieve') ? .32 : .24)); b.settle = 0; }
      else if (b.progress >= .879) { b.settle += dt; if (b.settle >= 1.05) {
        const recovered = b.sample.goldMg * (p.upgrades.includes('sieve') ? .92 : .82);
        p.goldMg += recovered; p.stats.pans++;
        const grade = recovered / 1000 / b.sample.mass;
        p.samples.unshift({ x: Math.round(b.sample.x), z: Math.round(b.sample.z), grade, goldMg: recovered, mass: b.sample.mass, label: gradeName(grade) });
        p.samples = p.samples.slice(0, 40); p.busy = null; mark(room);
        events.push({ player: p.id, result: good(recovered > .01 ? `Pan clean-up: ${(recovered / 1000).toFixed(3)} g. ${gradeName(grade)} sample.` : 'No gold this time. Try a different spot or a deeper gravel layer.', { gold: recovered }) });
      } }
    }
  }
  events.push(...tickRelics(room));
  events.push(...tickGuards(room,dt,now));
  events.push(...tickAutomation(room,rules,dt,now));
  for (const m of room.machines) {
    if(m.type==='feeder')continue;
    const cfg = config(rules, m.type);
    m.running = m.cargo.mass > 0 && (m.type !== 'rocker' || m.powered || Object.values(room.players).some(p => p.active && !p.vehicle && !p.busy && distance(p, m) < 5 && p.input.operate === m.id && p.input.wash && now - p.lastInput < 600));
    if (m.running) { const part = takeCargo(m.cargo, cfg.rate * dt); m.goldMg += part.goldMg * cfg.recovery; m.processed += part.mass; room.dirty = true; }
  }
  return events;
}

export function publicPlayer(p) {
  return { id: p.id, name: p.name, color: p.color, x: p.x, y: p.y, z: p.z, yaw: p.yaw, active: p.active, mineCart:p.mineCart||null,hoistRide:!!p.hoistRide,vehicle: p.vehicle, cart: p.cart, tool:p.input?.tool||'shovel',miningTool:miningTool(p).id,chopUntil:p.chopUntil||0,shovelMass: p.shovel?.mass || 0, shovelPlanted: !!p.shovelPlant, pitch:p.input?.pitch || 0, catching:catchingBucket(p),bucketX:p.input?.bucketX||0,bucketY:p.input?.bucketY||0,muddyUntil:p.muddyUntil||0,tumbleUntil: p.tumble?.until || 0, aid: p.aid || 0, helping: !!p.input?.help, emoteUntil: p.emoteUntil };
}
export function privatePlayer(p, rules) {
  return { ...publicPlayer(p), guardKnock:p.guardKnock||null,guardSafeUntil:p.guardSafeUntil||0,fly: !!p.fly, speedScale: p.speedScale || 1, jumpScale: p.jumpScale || 1, cheatSafe: !!p.cheatSafe, wood:p.wood||0,consoleMarks: p.consoleMarks || {}, cargo: { mass: p.cargo.mass }, goldMg: p.goldMg, capacity: bucketCapacity(p, rules), upgrades: p.upgrades, kits: p.kits, samples: p.samples, stats: p.stats,
    shovelPlant: p.shovelPlant ? {x:p.shovelPlant.x,y:p.shovelPlant.y,z:p.shovelPlant.z,mine:!!p.shovelPlant.mine} : null, bucketPos:p.bucketPos || null,
    busy: p.busy ? { progress: p.busy.progress, settle: p.busy.settle, mass: p.busy.sample.mass } : null };
}
export function snapshot(room, p, rules, now) {
  return { type: 'snapshot', now, revision: room.revision, cash: room.cash, crewSize: room.crewSize || 1, ownerId: room.ownerId, prices: Object.fromEntries(rules.catalog.map(c => [c.id, equipmentPrice(room, c)])), day: room.day, clock: room.clock,
    relics:relicPublic(room),quest:relicQuest(room),guards:guardsPublic(room),forest:forestPublic(room),mine:{...minePublic(ensureMine(room)),hazards:stabilityPublic(ensureSupports(room),p)}, players: Object.values(room.players).filter(p => p.active).map(publicPlayer), self: {...privatePlayer(p, rules),relics:relicBagPublic(room,p),relicSignal:relicSignal(room,p)}, unlocked: room.unlocked,
    machines: room.machines.map(m => ({ ...m, cargo: { mass: m.cargo.mass } })), vehicles: room.vehicles.map(v => ({ ...v,...(v.type==='excavator'?{arm:ensureArm(v)}:{}), cargo: { mass: v.cargo.mass } })),
    carts: (room.carts || []).map(c => ({ ...c, capacity: 180, safeLoad: 72, cargo: { mass: c.cargo.mass } })), spills: (room.spills || []).map(s => ({ id: s.id, x: s.x,y:s.y, z: s.z, cargo: { mass: s.cargo.mass } })),
    clods:(room.clods || []).map(c=>({id:c.id,x:c.x,y:c.y,z:c.z,vx:c.vx,vy:c.vy,vz:c.vz,mass:c.cargo.mass})),
    buckets:Object.values(room.players).filter(p=>p.bucketPos).map(p=>({id:`bucket-${p.id}`,owner:p.id,name:p.name,...p.bucketPos,mass:p.cargo.mass,capacity:bucketCapacity(p,rules)})),
    totalGoldMg: room.totalGoldMg, totalDugKg: room.totalDugKg };
}
