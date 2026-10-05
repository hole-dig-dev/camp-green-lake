import {inCanyon,canyonHeight,canyonBlend} from './canyon.mjs';
// Engine-neutral coordinates: metres, Y up, +X east, +Z south. Angles in radians.
export const SIZE = 224, STEP = 2, HALF = SIZE / 2, GRID = SIZE / STEP;
export const WATER = 1.05;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
export function random(seed, x = 0, z = 0, n = 0) {
  let h = hash(`${seed}:${x}:${z}:${n}`); h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function riverX(z) { return 6 + Math.sin(z * .041) * 9 + Math.cos(z * .018) * 4; }
export function nearWater(x, z, reach = 12) { return z>-24 && Math.abs(x - riverX(z)) < reach && Math.abs(z) < 107; }
export function baseHeight(x, z) {
  const d = Math.abs(x - riverX(z));
  const h = .3 + smooth(5, 14, d) * 2.7 + smooth(20, 104, d) * (5.8 + Math.sin(z * .029) * 2.5) + Math.sin(x * .078) * .19 + Math.cos(z * .065) * .16;
  const town = (1 - smooth(14, 22, Math.abs(x + 39))) * (1 - smooth(12, 23, Math.abs(z - 58)));
  const surface=h*(1-town)+3.15*town;
  const mine=(1-smooth(0,4,Math.max(-88-x,x+40,0)))*(1-smooth(0,4,Math.max(-12-z,z-36,0)));
  const legacy=surface*(1-mine)+6*mine,b=canyonBlend(x,z);return legacy*(1-b)+canyonHeight(x,z)*b;
}
export const keyOf = (ix, iz) => `${ix},${iz}`;
export function toCell(x, z) { return { ix: clamp(Math.round((x + HALF) / STEP), 0, GRID), iz: clamp(Math.round((z + HALF) / STEP), 0, GRID) }; }
export function fromCell(ix, iz) { return { x: ix * STEP - HALF, z: iz * STEP - HALF }; }
export function vertexHeight(ix, iz, cells = {}) {
  const p = fromCell(ix, iz); return baseHeight(p.x, p.z) - (cells[keyOf(ix, iz)]?.depth || 0);
}
export function heightAt(x, z, cells = {}) {
  const gx = clamp((x + HALF) / STEP, 0, GRID - .001), gz = clamp((z + HALF) / STEP, 0, GRID - .001);
  const ix = Math.floor(gx), iz = Math.floor(gz), tx = gx - ix, tz = gz - iz;
  return (vertexHeight(ix, iz, cells) * (1 - tx) + vertexHeight(ix + 1, iz, cells) * tx) * (1 - tz) +
    (vertexHeight(ix, iz + 1, cells) * (1 - tx) + vertexHeight(ix + 1, iz + 1, cells) * tx) * tz;
}
export function protectedGround(x, z) { return x > -57 && x < -20 && z > 39 && z < 78; }
export function canWalk(x, z, radius = .35) {
  if (Math.abs(x) > HALF - 3 || Math.abs(z) > HALF - 3) return false;
  const buildings = [[-37, 69, 5.5, 3.3], [-46, 44, 5.7, 3.4], [-27, 71, 4, 3]];
  return !buildings.some(([bx, bz, w, d]) => Math.abs(x - bx) < w + radius && Math.abs(z - bz) < d + radius);
}
export function deposits(seed) {
  return [-76, -27, 35, 79].map((base, i) => {
    const z = base + (random(seed, i, 0, 50) - .5) * 17;
    return { x: riverX(z) + (i % 2 ? -1 : 1) * (9 + random(seed, i, 0, 51) * 15), z, width: 7 + random(seed, i, 0, 52) * 7, length: 13 + random(seed, i, 0, 53) * 13, depth: .65 + random(seed, i, 0, 54) * 1.6 };
  });
}
export function goldInScoop(seed, ix, iz, depth, digs, mass) {
  const { x, z } = fromCell(ix, iz);
  const d = Math.abs(x - riverX(z));
  let grade = Math.exp(-Math.pow(d / 15, 2)) * .0009;
  for (const dep of deposits(seed)) {
    const footprint = Math.exp(-((x - dep.x) ** 2 / dep.width ** 2 + (z - dep.z) ** 2 / dep.length ** 2));
    const layer = .06 + Math.exp(-(((depth - dep.depth) / .6) ** 2)) * .94;
    grade += footprint * layer * .048;
  }
  if (depth > 3.5) grade *= .025;
  const luck = random(seed, ix, iz, digs * 2 + 100);
  let mg = grade * mass * 1000 * (.2 + luck * 1.6);
  if (luck < .28 && grade < .002) mg = 0;
  if (luck > .991 && grade > .002) mg += mass * (4 + random(seed, ix, iz, digs + 555) * 13);
  return Math.round(mg * 100) / 100;
}
export function gradeName(gramsPerKg) {
  if (gramsPerKg <= .00005) return 'Barren';
  if (gramsPerKg < .001) return 'Trace';
  if (gramsPerKg < .004) return 'Promising';
  if (gramsPerKg < .013) return 'Pay dirt';
  return 'Rich';
}

// Stable tree IDs: the renderer and host use the same forest layout.
export const FOREST_TREES=[];
for(let i=0;i<600&&FOREST_TREES.length<140;i++){const x=random(891,i)*220-110,z=random(892,i)*220-110;if(inCanyon(x,z)&&baseHeight(x,z)<3||nearWater(x,z,22)||x>-61&&x<-9&&z>30&&z<84)continue;FOREST_TREES.push({id:'tree'+i,x,z,scale:1+random(893,i)*1.1,y:baseHeight(x,z)});}
