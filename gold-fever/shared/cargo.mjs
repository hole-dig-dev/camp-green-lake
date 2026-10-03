export const emptyCargo = () => ({ mass: 0, goldMg: 0, x: 0, z: 0 });
export function addCargo(to, part) {
  const total = to.mass + part.mass;
  if (!total) return;
  to.x = (to.x * to.mass + part.x * part.mass) / total;
  to.z = (to.z * to.mass + part.z * part.mass) / total;
  to.mass = total; to.goldMg += part.goldMg;
}
export function takeCargo(from, mass) {
  mass = Math.min(from.mass, Math.max(0, mass));
  const out = { mass, goldMg: from.mass ? from.goldMg * mass / from.mass : 0, x: from.x, z: from.z };
  from.mass -= mass; from.goldMg -= out.goldMg;
  if (from.mass < 1e-8) Object.assign(from, emptyCargo());
  return out;
}
